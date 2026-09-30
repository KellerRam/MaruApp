const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { enviarPushATokens } = require('../utils/pushNotifications');
const { crearUrlMedia } = require('../utils/mediaAccess');

const directorioChat = path.join(__dirname, '../../uploads/chat');
fs.mkdirSync(directorioChat, { recursive: true });

const limpiarArchivo = async (ruta) => {
  if (!ruta) return;
  try {
    await fs.promises.unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo limpiar el archivo de chat:', error.message);
  }
};

const esMiembro = async (idGrupo, idUsuario) => {
  const resultado = await pool.query(
    'SELECT 1 FROM grupo_usuario WHERE id_grupo::text = $1::text AND id_usuario::text = $2::text',
    [idGrupo, idUsuario]
  );
  return resultado.rows.length > 0;
};

const listarMensajes = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const idUsuario = req.usuarioAutenticado.id;
    if (!(await esMiembro(idGrupo, idUsuario))) {
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }

    const resultado = await pool.query(
      `SELECT m.id_mensaje, m.id_usuario, m.tipo, m.texto, m.archivo_url,
              m.archivo_nombre, m.mime_type, m.creado_en,
              u.nombre_usuario AS remitente,
              (m.id_usuario = $2) AS es_mio
       FROM chat_mensaje m
       INNER JOIN usuario u ON u.id_usuario = m.id_usuario
       WHERE m.id_grupo = $1
       ORDER BY m.creado_en ASC, m.id_mensaje ASC
       LIMIT 200`,
      [idGrupo, idUsuario]
    );

    const mensajesVisibles = resultado.rows
      .map((mensaje) => ({
        ...mensaje,
        archivo_url: mensaje.archivo_url ? crearUrlMedia(mensaje.archivo_url) : null,
      }));

    res.status(200).json({ mensajes: mensajesVisibles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const previsualizacionMensaje = (tipo, texto) => {
  if (tipo === 'imagen') return '📷 Imagen';
  if (tipo === 'audio') return '🎤 Nota de voz';
  if (tipo === 'documento') return '📎 Documento';
  return (texto || '').slice(0, 120);
};

// Envía una notificación push con previsualización a los demás miembros del grupo
const notificarNuevoMensaje = async ({ idGrupo, idUsuario, tipo, texto }) => {
  try {
    const remitenteRes = await pool.query('SELECT nombre_usuario FROM usuario WHERE id_usuario = $1', [idUsuario]);
    const nombreRemitente = remitenteRes.rows[0]?.nombre_usuario || 'Alguien';

    const destinatariosRes = await pool.query(
      `SELECT gu.id_usuario, u.push_token,
              CASE WHEN p.id_usuario IS NOT NULL THEN 'paciente'
                   WHEN c.id_usuario IS NOT NULL THEN 'cuidador'
                   ELSE COALESCE(gu.rol, 'cuidador') END AS rol
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       LEFT JOIN paciente p ON p.id_usuario = gu.id_usuario
       LEFT JOIN cuidador c ON c.id_usuario = gu.id_usuario
       WHERE gu.id_grupo::text = $1::text AND gu.id_usuario::text <> $2::text`,
      [idGrupo, idUsuario]
    );

    const tokens = destinatariosRes.rows.map((m) => m.push_token);

    await enviarPushATokens(tokens, {
      title: nombreRemitente,
      body: previsualizacionMensaje(tipo, texto),
      data: { tipo: 'chat', id_grupo: idGrupo },
    });
  } catch (error) {
    console.error('Error al notificar nuevo mensaje:', error.message);
  }
};

const crearMensaje = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const { tipo = 'texto', texto = '' } = req.body;
    const idUsuario = req.usuarioAutenticado.id;
    const tiposPermitidos = ['texto', 'imagen', 'documento', 'audio'];

    if (!tiposPermitidos.includes(tipo)) {
      await limpiarArchivo(req.file?.path);
      return res.status(400).json({ error: 'El tipo de mensaje no es válido' });
    }
    if (!(await esMiembro(idGrupo, idUsuario))) {
      await limpiarArchivo(req.file?.path);
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }
    if (tipo === 'texto' && !texto.trim()) {
      await limpiarArchivo(req.file?.path);
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    if (tipo !== 'texto' && !req.file) {
      return res.status(400).json({ error: 'El archivo del mensaje es obligatorio' });
    }
    const archivoUrl = req.file ? `/uploads/chat/${req.file.filename}` : null;
    const resultado = await pool.query(
      `INSERT INTO chat_mensaje
        (id_grupo, id_usuario, tipo, texto, archivo_url, archivo_nombre, mime_type)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)
       RETURNING id_mensaje, id_grupo, id_usuario, tipo, texto, archivo_url,
                 archivo_nombre, mime_type, creado_en`,
      [idGrupo, idUsuario, tipo, texto, archivoUrl, req.file?.originalname || null, req.file?.mimetype || null]
    );

    await notificarNuevoMensaje({ idGrupo, idUsuario, tipo, texto });

    const mensaje = resultado.rows[0];
    if (mensaje.archivo_url) mensaje.archivo_url = crearUrlMedia(mensaje.archivo_url);
    res.status(201).json({ mensaje });
  } catch (error) {
    await limpiarArchivo(req.file?.path);
    res.status(500).json({ error: error.message });
  }
};

const eliminarMensaje = async (req, res) => {
  try {
    const { idMensaje } = req.params;
    const idUsuario = req.usuarioAutenticado.id;

    const mensajeRes = await pool.query(
      'SELECT id_usuario, id_grupo, archivo_url, creado_en FROM chat_mensaje WHERE id_mensaje = $1',
      [idMensaje]
    );

    if (mensajeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const mensaje = mensajeRes.rows[0];
    if (!(await esMiembro(mensaje.id_grupo, idUsuario))) {
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }

    if (Number(mensaje.id_usuario) !== Number(idUsuario)) {
      return res.status(403).json({ error: 'No puedes eliminar mensajes de otros usuarios' });
    }

    const diferenciaMinutos = (new Date() - new Date(mensaje.creado_en)) / (1000 * 60);
    if (diferenciaMinutos > 30) {
      return res.status(400).json({ error: 'El tiempo límite para eliminar este mensaje ha expirado (30 minutos)' });
    }

    await pool.query('DELETE FROM chat_mensaje WHERE id_mensaje = $1', [idMensaje]);
    if (mensaje.archivo_url) {
      const rutaFisica = path.join(directorioChat, path.basename(mensaje.archivo_url));
      await limpiarArchivo(rutaFisica);
    }

    res.status(200).json({ mensaje: 'Mensaje eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { listarMensajes, crearMensaje, eliminarMensaje, directorioChat };
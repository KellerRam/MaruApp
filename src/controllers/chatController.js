const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const directorioChat = path.join(__dirname, '../../uploads/chat');
fs.mkdirSync(directorioChat, { recursive: true });

const esMiembro = async (idGrupo, idUsuario) => {
  const resultado = await pool.query(
    'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
    [idGrupo, idUsuario]
  );
  return resultado.rows.length > 0;
};

const listarMensajes = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const { idUsuario } = req.query;
    if (!idUsuario || !(await esMiembro(idGrupo, idUsuario))) {
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

    res.status(200).json({ mensajes: resultado.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearMensaje = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const { idUsuario, tipo = 'texto', texto = '' } = req.body;
    const tiposPermitidos = ['texto', 'imagen', 'documento', 'audio'];

    if (!idUsuario || !tiposPermitidos.includes(tipo)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'El usuario y el tipo de mensaje son obligatorios' });
    }
    if (!(await esMiembro(idGrupo, idUsuario))) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }
    if (tipo === 'texto' && !texto.trim()) {
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

    res.status(201).json({ mensaje: resultado.rows[0] });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message });
  }
};

module.exports = { listarMensajes, crearMensaje, directorioChat };

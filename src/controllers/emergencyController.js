const pool = require('../config/db');
const { enviarPushATokens } = require('../utils/pushNotifications');

// Lógica compartida: registra la emergencia, notifica al grupo y la publica en el chat
const dispararEmergencia = async (idGrupo, idUsuario, motivoPersonalizado) => {
  const client = await pool.connect();
  try {
    const miembro = await client.query(
      'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
      [idGrupo, idUsuario]
    );
    if (miembro.rows.length === 0) {
      const error = new Error('No perteneces a este grupo');
      error.status = 403;
      throw error;
    }

    const ahora = new Date();
    const mensaje = motivoPersonalizado
      ? `EMERGENCIA: ${motivoPersonalizado} (${ahora.toLocaleDateString('es-ES')} ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`
      : `EMERGENCIA activada el ${ahora.toLocaleDateString('es-ES')} a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

    await client.query('BEGIN');
    const miembros = await client.query(
      `SELECT gu.id_usuario, u.push_token
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1`,
      [idGrupo]
    );
    for (const miembroGrupo of miembros.rows) {
      await client.query(
        `INSERT INTO notificacion (tipo_notificacion, hora_notificacion, id_usuario, sintomas)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
        ['emergencia_urgente', miembroGrupo.id_usuario, mensaje]
      );
    }
    await client.query(
      `INSERT INTO chat_mensaje (id_grupo, id_usuario, tipo, texto)
       VALUES ($1, $2, 'texto', $3)`,
      [idGrupo, idUsuario, mensaje]
    );
    await client.query('COMMIT');

    const tokensDestino = miembros.rows
      .filter((m) => Number(m.id_usuario) !== Number(idUsuario))
      .map((m) => m.push_token);
    await enviarPushATokens(tokensDestino, {
      title: '🚨 Emergencia activada',
      body: mensaje,
      data: { tipo: 'emergencia', id_grupo: idGrupo },
    });

    return mensaje;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const activarEmergencia = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const idUsuario = req.usuarioAutenticado.id;

    const textoChat = await dispararEmergencia(idGrupo, idUsuario, null);
    res.status(201).json({ mensaje: 'Emergencia notificada a todos los miembros', textoChat });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Disparada por el sensor de agitación del dispositivo del paciente/cuidador
const activarEmergenciaPorSensor = async (req, res) => {
  try {
    const { id_grupo: idGrupo, motivo } = req.body || {};
    const idUsuario = req.usuarioAutenticado.id;
    if (!idGrupo) {
      return res.status(400).json({ error: 'El grupo es obligatorio' });
    }

    const textoChat = await dispararEmergencia(idGrupo, idUsuario, motivo || 'Agitación brusca detectada por sensor');
    res.status(201).json({ mensaje: 'Emergencia notificada a todos los miembros', textoChat });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = { activarEmergencia, activarEmergenciaPorSensor };


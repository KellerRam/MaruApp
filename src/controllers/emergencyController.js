const pool = require('../config/db');

const activarEmergencia = async (req, res) => {
  const client = await pool.connect();
  try {
    const { idGrupo } = req.params;
    const { idUsuario } = req.body || {};
    if (!idUsuario) return res.status(400).json({ error: 'El usuario activo es obligatorio' });

    const miembro = await client.query(
      'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
      [idGrupo, idUsuario]
    );
    if (miembro.rows.length === 0) return res.status(403).json({ error: 'No perteneces a este grupo' });

    const ahora = new Date();
    const mensaje = `EMERGENCIA activada el ${ahora.toLocaleDateString('es-ES')} a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

    await client.query('BEGIN');
    const miembros = await client.query(
      'SELECT id_usuario FROM grupo_usuario WHERE id_grupo = $1',
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

    res.status(201).json({ mensaje: 'Emergencia notificada a todos los miembros', textoChat: mensaje });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = { activarEmergencia };

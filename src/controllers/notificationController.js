// controllers/notificationController.js
const pool = require('../config/db'); // O tu conexión a PostgreSQL

// Obtener preferencias de notificaciones del paciente
const obtenerPreferencias = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const resultado = await pool.query(
      'SELECT confirmacion_bienestar, bienestar_frecuencia FROM paciente WHERE id_usuario = $1',
      [id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({
      confirmacion_bienestar: resultado.rows[0].confirmacion_bienestar,
      frecuencia: resultado.rows[0].bienestar_frecuencia || 1,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar confirmacion_bienestar y la frecuencia diaria de alertas
const actualizarBienestar = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { confirmacion_bienestar, frecuencia } = req.body;

    const frecuenciaValida = Math.min(5, Math.max(1, parseInt(frecuencia, 10) || 1));

    await pool.query(
      'UPDATE paciente SET confirmacion_bienestar = $1, bienestar_frecuencia = $2 WHERE id_usuario = $3',
      [confirmacion_bienestar, frecuenciaValida, id_usuario]
    );

    res.json({ mensaje: 'Preferencia de bienestar actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Guarda o actualiza el token de notificaciones push del dispositivo del usuario
const guardarTokenPush = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { push_token } = req.body || {};

    if (!push_token) {
      return res.status(400).json({ error: 'El token push es obligatorio' });
    }

    await pool.query('UPDATE usuario SET push_token = $1 WHERE id_usuario = $2', [push_token, id_usuario]);
    res.status(200).json({ mensaje: 'Token push registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marca una alerta (bienestar o medicamento) como leída/confirmada, deteniendo los reintentos
const confirmarAlerta = async (req, res) => {
  try {
    const { tipo, id_usuario, clave_ocurrencia } = req.body || {};
    if (!tipo || !id_usuario || !clave_ocurrencia) {
      return res.status(400).json({ error: 'tipo, id_usuario y clave_ocurrencia son obligatorios' });
    }

    const resultado = await pool.query(
      `UPDATE alerta_notificacion SET leida = true
       WHERE tipo = $1 AND id_usuario = $2 AND clave_ocurrencia = $3
       RETURNING id_alerta`,
      [tipo, id_usuario, clave_ocurrencia]
    );

    if (resultado.rows.length === 0) {
      // Si aún no existía un registro (confirmación anticipada), se crea ya marcado como leído
      await pool.query(
        `INSERT INTO alerta_notificacion (tipo, id_usuario, clave_ocurrencia, leida)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (tipo, id_usuario, clave_ocurrencia) DO UPDATE SET leida = true`,
        [tipo, id_usuario, clave_ocurrencia]
      );
    }

    res.status(200).json({ mensaje: 'Alerta confirmada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { obtenerPreferencias, actualizarBienestar, guardarTokenPush, confirmarAlerta };

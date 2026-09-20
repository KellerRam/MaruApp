const pool = require('../config/db');

const crearSintoma = async (req, res) => {
  try {
    const { idUsuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma } = req.body || {};

    if (!idUsuario || !nombre_sintoma?.trim() || !descripcion?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_sintoma || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_sintoma || '')) {
      return res.status(400).json({ error: 'Síntoma, descripción, fecha y hora son obligatorios' });
    }

    const paciente = await pool.query(
      'SELECT id_usuario FROM paciente WHERE id_usuario = $1',
      [idUsuario]
    );
    if (paciente.rows.length === 0) {
      return res.status(403).json({ error: 'El usuario activo no está asociado a un paciente' });
    }

    const resultado = await pool.query(
      `INSERT INTO sintoma (id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_sintoma, id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma`,
      [idUsuario, nombre_sintoma.trim(), descripcion.trim(), fecha_sintoma, `${hora_sintoma}:00`]
    );

    res.status(201).json({ sintoma: resultado.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { crearSintoma };

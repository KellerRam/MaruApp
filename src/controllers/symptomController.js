const pool = require('../config/db');

const fechaISOValida = (fecha) => typeof fecha === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  && !Number.isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
  && new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;

const hora24Valida = (hora) => {
  if (typeof hora !== 'string') return false;
  // Permite tanto HH:MM como HH:MM:SS
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora);
};

const crearSintoma = async (req, res) => {
  try {
    const { nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma } = req.body || {};
    const idUsuario = req.usuarioAutenticado.id;

    if (!nombre_sintoma?.trim() || !descripcion?.trim() || !fechaISOValida(fecha_sintoma) || !hora24Valida(hora_sintoma)) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios y deben ser válidos' });
    }

    const grupoRes = await pool.query(
      'SELECT id_grupo FROM grupo_usuario WHERE id_usuario = $1',
      [idUsuario]
    );

    if (grupoRes.rows.length === 0) {
      return res.status(403).json({ error: 'El usuario activo no pertenece a ningún grupo' });
    }

    const idGrupo = grupoRes.rows[0].id_grupo;

    const pacienteRes = await pool.query(
      `SELECT u.id_usuario FROM usuario u 
       JOIN grupo_usuario gu ON u.id_usuario = gu.id_usuario 
       WHERE gu.id_grupo = $1 AND LOWER(TRIM(gu.rol)) = 'paciente'`,
      [idGrupo]
    );

    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'No hay un paciente asignado' });
    }

    const idPaciente = pacienteRes.rows[0].id_usuario;

    const resultado = await pool.query(
      `INSERT INTO sintoma (id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_sintoma, id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma`,
      [idPaciente, nombre_sintoma.trim(), descripcion.trim(), fecha_sintoma, `${hora_sintoma}:00`]
    );

    res.status(201).json({ sintoma: resultado.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener síntomas buscando al paciente del grupo del usuario actual
const obtenerSintomas = async (req, res) => {
  try {
    const { idUsuario } = req.params;
    if (!idUsuario) {
      return res.status(400).json({ error: 'El ID de usuario es obligatorio' });
    }

    let targetUserId = idUsuario;
    const grupoRes = await pool.query('SELECT id_grupo FROM grupo_usuario WHERE id_usuario = $1', [idUsuario]);
    
    if (grupoRes.rows.length > 0) {
      const idGrupo = grupoRes.rows[0].id_grupo;
      const pacienteRes = await pool.query(
        `SELECT u.id_usuario FROM usuario u 
         JOIN grupo_usuario gu ON u.id_usuario = gu.id_usuario 
         WHERE gu.id_grupo = $1 AND LOWER(TRIM(gu.rol)) = 'paciente'`,
        [idGrupo]
      );
      if (pacienteRes.rows.length > 0) {
        targetUserId = pacienteRes.rows[0].id_usuario;
      }
    }

    const resultado = await pool.query(
      `SELECT id_sintoma, id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma 
       FROM sintoma 
       WHERE id_usuario = $1 
       ORDER BY fecha_sintoma DESC, hora_sintoma DESC`,
      [targetUserId]
    );

    res.status(200).json({ sintomas: resultado.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarSintoma = async (req, res) => {
  try {
    const { idSintoma } = req.params;
    const { nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma } = req.body || {};

    if (!nombre_sintoma?.trim() || !descripcion?.trim() || !fechaISOValida(fecha_sintoma) || !hora24Valida(hora_sintoma)) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios y deben ser válidos' });
    }

    const horaLimpia = hora_sintoma.length === 5 ? `${hora_sintoma}:00` : hora_sintoma;

    const resultado = await pool.query(
      `UPDATE sintoma 
       SET nombre_sintoma = $1, descripcion = $2, fecha_sintoma = $3, hora_sintoma = $4 
       WHERE id_sintoma = $5 
       RETURNING id_sintoma, id_usuario, nombre_sintoma, descripcion, fecha_sintoma, hora_sintoma`,
      [nombre_sintoma.trim(), descripcion.trim(), fecha_sintoma, horaLimpia, idSintoma]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Síntoma no encontrado' });
    }

    return res.status(200).json({ sintoma: resultado.rows[0] });
  } catch (error) {
    console.error('Error en actualizarSintoma:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Eliminar síntoma
const eliminarSintoma = async (req, res) => {
  try {
    const { idSintoma } = req.params;
    const resultado = await pool.query(
      'DELETE FROM sintoma WHERE id_sintoma = $1 RETURNING id_sintoma',
      [idSintoma]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Síntoma no encontrado' });
    }

    res.status(200).json({ mensaje: 'Síntoma eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { crearSintoma, obtenerSintomas, actualizarSintoma, eliminarSintoma };
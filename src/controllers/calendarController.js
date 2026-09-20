// src/controllers/calendarController.js
const pool = require('../config/db');

// Obtener o crear el calendario del grupo y listar sus eventos
const obtenerCalendarioYEventos = async (req, res) => {
  try {
    const { idGrupo } = req.params;

    if (!idGrupo) {
      return res.status(400).json({ error: 'El ID de grupo es obligatorio' });
    }

    // 1. Buscar si ya existe un calendario para este grupo
    let calRes = await pool.query(
      'SELECT id_calendario, fecha, id_grupo FROM calendario WHERE id_grupo = $1',
      [idGrupo]
    );

    let idCalendario;

    if (calRes.rows.length === 0) {
      // Si no existe, crear el calendario único para el grupo
      const nuevoCal = await pool.query(
        'INSERT INTO calendario (fecha, id_grupo) VALUES (CURRENT_DATE, $1) RETURNING id_calendario, fecha, id_grupo',
        [idGrupo]
      );
      idCalendario = nuevoCal.rows[0].id_calendario;
    } else {
      idCalendario = calRes.rows[0].id_calendario;
    }

    // 2. Obtener todos los eventos asociados a este calendario
    const eventosRes = await pool.query(
      `SELECT 
        id_evento, 
        nombre_evento, 
        hora_evento, 
        TO_CHAR(fecha_evento, 'YYYY-MM-DD') AS fecha_evento, 
        id_calendario 
       FROM evento 
       WHERE id_calendario = $1 
       ORDER BY fecha_evento ASC, hora_evento ASC`,
      [idCalendario]
    );

    res.status(200).json({
      id_calendario: idCalendario,
      id_grupo: parseInt(idGrupo, 10),
      eventos: eventosRes.rows
    });
  } catch (error) {
    console.error('Error en obtenerCalendarioYEventos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Crear un nuevo evento asociado al calendario
const crearEvento = async (req, res) => {
  try {
    const { nombre_evento, fecha_evento, hora_evento, id_calendario } = req.body;

    if (!nombre_evento || !fecha_evento || !hora_evento || !id_calendario) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios: nombre_evento, fecha_evento, hora_evento, id_calendario'
      });
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora_evento.trim())) {
      return res.status(400).json({ error: 'La hora debe estar en formato de 24 horas HH:MM' });
    }

    // Formatear hora si viene como HH:MM
    let horaFinal = hora_evento.trim();
    if (horaFinal.length === 5) {
      horaFinal += ':00';
    }

    const nuevoEvento = await pool.query(
      `INSERT INTO evento (nombre_evento, fecha_evento, hora_evento, id_calendario)
       VALUES ($1, $2, $3, $4)
       RETURNING id_evento, nombre_evento, hora_evento, TO_CHAR(fecha_evento, 'YYYY-MM-DD') AS fecha_evento, id_calendario`,
      [nombre_evento.trim(), fecha_evento.trim(), horaFinal, parseInt(id_calendario, 10)]
    );

    res.status(201).json({
      mensaje: 'Evento creado exitosamente',
      evento: nuevoEvento.rows[0]
    });
  } catch (error) {
    console.error('Error en crearEvento:', error);
    res.status(500).json({ error: error.message });
  }
};

const actualizarEvento = async (req, res) => {
  try {
    const { nombre_evento, fecha_evento, hora_evento } = req.body;
    if (!nombre_evento?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_evento || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_evento || '')) {
      return res.status(400).json({ error: 'Nombre, fecha válida y hora HH:MM son obligatorios' });
    }
    const resultado = await pool.query(
      `UPDATE evento SET nombre_evento = $1, fecha_evento = $2, hora_evento = $3
       WHERE id_evento = $4
       RETURNING id_evento, nombre_evento, hora_evento, TO_CHAR(fecha_evento, 'YYYY-MM-DD') AS fecha_evento, id_calendario`,
      [nombre_evento.trim(), fecha_evento, `${hora_evento}:00`, req.params.id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.status(200).json({ evento: resultado.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const eliminarEvento = async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM evento WHERE id_evento = $1 RETURNING id_evento', [req.params.id]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.status(200).json({ mensaje: 'Evento eliminado' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = {
  obtenerCalendarioYEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento
};

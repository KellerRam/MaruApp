// src/controllers/scheduleController.js
const pool = require('../config/db');

const obtenerHorariosYEventos = async (req, res) => {
  try {
    const { idGrupo } = req.params;

    if (!idGrupo) {
      return res.status(400).json({ error: 'El ID de grupo es obligatorio' });
    }

    const horariosRes = await pool.query(
      `SELECT hc.*,
          TO_CHAR(hc.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
          TO_CHAR(hc.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
       FROM horario_cuidado hc
       JOIN grupo_usuario gu ON hc.id_cuidador = gu.id_usuario
       WHERE gu.id_grupo = $1`,
      [idGrupo]
    );

    const eventosRes = await pool.query(
      `SELECT e.* FROM Evento e 
       JOIN Calendario c ON e.id_calendario = c.id_calendario 
       WHERE c.id_grupo = $1`,
      [idGrupo]
    );

    const medicamentosRes = await pool.query(
      `SELECT hm.id_horario_medicamento, hm.hora_toma, hm.frecuencia,
              m.id_medicamento, m.nombre_medicamento, m.dosis, m.presentacion,
              TO_CHAR(hm.fecha_toma, 'YYYY-MM-DD') AS fecha_inicio
       FROM horario_medicamento hm
       INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento
       WHERE m.id_grupo = $1`,
      [idGrupo]
    );

    res.status(200).json({
      horariosCuidado: horariosRes.rows,
      medicamentos: medicamentosRes.rows,
      eventosProximos: eventosRes.rows
    });
  } catch (error) {
    console.error('Error en obtenerHorariosYEventos:', error);
    res.status(500).json({ error: error.message });
  }
};

const crearHorarioMedicamento = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_grupo, fecha_inicio, nombre_medicamento, dosis, presentacion, frecuencia, hora_toma } = req.body || {};

    if (!id_grupo || !fecha_inicio || !nombre_medicamento?.trim() || !dosis?.trim() || !presentacion?.trim() || !hora_toma) {
      return res.status(400).json({ error: 'Todos los campos obligatorios del medicamento deben estar completos' });
    }

    let horaFinal = hora_toma.trim();
    if (horaFinal.length === 5) horaFinal += ':00';

    await client.query('BEGIN');

    const medicamento = await client.query(
      `INSERT INTO medicamento (nombre_medicamento, dosis, presentacion, id_grupo)
       VALUES ($1, $2, $3, $4) RETURNING id_medicamento`,
      [nombre_medicamento.trim(), dosis.trim(), presentacion.trim(), id_grupo]
    );

    const toma = await client.query(
      `INSERT INTO horario_medicamento (id_medicamento, frecuencia, hora_toma, fecha_toma)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [medicamento.rows[0].id_medicamento, frecuencia ? frecuencia.trim() : null, horaFinal, fecha_inicio.trim()]
    );

    await client.query('COMMIT');

    const tomaCompleta = {
      ...toma.rows[0],
      nombre_medicamento: nombre_medicamento.trim(),
      dosis: dosis.trim(),
      presentacion: presentacion.trim(),
      frecuencia: frecuencia ? frecuencia.trim() : null,
      fecha_inicio: fecha_inicio.trim() // Se envía como fecha_inicio para el frontend
    };

    res.status(201).json({ mensaje: 'Toma creada exitosamente', toma: tomaCompleta });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error en crearHorarioMedicamento:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const eliminarHorarioMedicamento = async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM horario_medicamento WHERE id_horario_medicamento = $1 RETURNING id_medicamento',
      [req.params.id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Toma no encontrada' });

    await pool.query('DELETE FROM medicamento WHERE id_medicamento = $1', [resultado.rows[0].id_medicamento]);

    res.status(200).json({ mensaje: 'Toma eliminada exitosamente' });
  } catch (error) {
    console.error('Error en eliminarHorarioMedicamento:', error);
    res.status(500).json({ error: error.message });
  }
};

const actualizarHorarioMedicamento = async (req, res) => {
  try {
    const { nombre_medicamento, dosis, presentacion, frecuencia, hora_toma, fecha_inicio } = req.body;

    if (!nombre_medicamento?.trim() || !dosis?.trim() || !presentacion?.trim() || !hora_toma || !fecha_inicio) {
      return res.status(400).json({ error: 'Todos los campos son requeridos para actualizar' });
    }

    let horaFinal = hora_toma.trim();
    if (horaFinal.length === 5) horaFinal += ':00';

    const resultado = await pool.query(
      `UPDATE medicamento m
       SET nombre_medicamento = $1, dosis = $2, presentacion = $3
       FROM horario_medicamento hm
       WHERE hm.id_horario_medicamento = $4 AND hm.id_medicamento = m.id_medicamento
       RETURNING hm.id_horario_medicamento`,
      [nombre_medicamento.trim(), dosis.trim(), presentacion.trim(), req.params.id]
    );

    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Toma no encontrada' });

    await pool.query(
      'UPDATE horario_medicamento SET frecuencia = $1, hora_toma = $2, fecha_toma = $3 WHERE id_horario_medicamento = $4',
      [frecuencia ? frecuencia.trim() : null, horaFinal, fecha_inicio.trim(), req.params.id]
    );

    res.status(200).json({ mensaje: 'Toma actualizada exitosamente' });
  } catch (error) {
    console.error('Error en actualizarHorarioMedicamento:', error);
    res.status(500).json({ error: error.message });
  }
};

const crearHorarioCuidado = async (req, res) => {
  try {
    const { id_grupo, id_cuidador, fecha_inicio, fecha_fin, hora_inicio, hora_fin } = req.body || {};

    if (!id_grupo || !id_cuidador || !fecha_inicio || !fecha_fin || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Todos los campos del turno son obligatorios' });
    }

    let hInicio = hora_inicio.trim();
    if (hInicio.length === 5) hInicio += ':00';
    let hFin = hora_fin.trim();
    if (hFin.length === 5) hFin += ':00';

    const usuarioRes = await pool.query(
      `SELECT u.nombre_usuario 
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       INNER JOIN cuidador c ON c.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND gu.id_usuario = $2`,
      [id_grupo, id_cuidador]
    );

    if (usuarioRes.rows.length === 0) {
      return res.status(400).json({ error: 'El cuidador seleccionado no existe en este grupo' });
    }

    const nombreEncargado = usuarioRes.rows[0].nombre_usuario;

    const nuevoHorario = await pool.query(
      `INSERT INTO horario_cuidado (id_cuidador, encargado, hora_inicio, hora_fin, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_cuidador, nombreEncargado, hInicio, hFin, fecha_inicio.trim(), fecha_fin.trim()]
    );

    const horarioCompleto = {
      ...nuevoHorario.rows[0],
      fecha_inicio: fecha_inicio.trim(),
      fecha_fin: fecha_fin.trim()
    };

    res.status(201).json({ mensaje: 'Turno creado exitosamente', horario: horarioCompleto });
  } catch (error) {
    console.error('Error al crear horario de cuidado:', error);
    res.status(500).json({ error: error.message });
  }
};

const actualizarHorarioCuidado = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_cuidador, fecha_inicio, fecha_fin, hora_inicio, hora_fin } = req.body;

    if (!id_cuidador || !fecha_inicio || !fecha_fin || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios para actualizar el turno' });
    }

    let hInicio = hora_inicio.trim();
    if (hInicio.length === 5) hInicio += ':00';
    let hFin = hora_fin.trim();
    if (hFin.length === 5) hFin += ':00';

    const usuarioRes = await pool.query(
      'SELECT nombre_usuario FROM usuario WHERE id_usuario = $1',
      [id_cuidador]
    );
    const nombreEncargado = usuarioRes.rows[0]?.nombre_usuario || '';

    const resultado = await pool.query(
      `UPDATE horario_cuidado
       SET id_cuidador = $1,
           encargado = $2,
           hora_inicio = $3, 
           hora_fin = $4,
           fecha_inicio = $5,
           fecha_fin = $6
       WHERE id_horario_cuidado = $7
       RETURNING *`,
      [id_cuidador, nombreEncargado, hInicio, hFin, fecha_inicio.trim(), fecha_fin.trim(), id]
    );

    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Turno no encontrado' });

    const horarioCompleto = {
      ...resultado.rows[0],
      fecha_inicio: fecha_inicio.trim(),
      fecha_fin: fecha_fin.trim()
    };

    res.status(200).json({ mensaje: 'Turno actualizado exitosamente', horario: horarioCompleto });
  } catch (error) {
    console.error('Error en actualizarHorarioCuidado:', error);
    res.status(500).json({ error: error.message });
  }
};

const eliminarHorarioCuidado = async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'DELETE FROM horario_cuidado WHERE id_horario_cuidado = $1 RETURNING id_horario_cuidado',
      [id]
    );

    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Turno no encontrado' });

    res.status(200).json({ mensaje: 'Horario de cuidado eliminado exitosamente' });
  } catch (error) {
    console.error('Error en eliminarHorarioCuidado:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  obtenerHorariosYEventos,
  crearHorarioCuidado,
  crearHorarioMedicamento,
  actualizarHorarioMedicamento,
  actualizarHorarioCuidado,
  eliminarHorarioCuidado,
  eliminarHorarioMedicamento
};
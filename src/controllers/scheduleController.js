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
  let client;
  try {
    client = await pool.connect();
    const { 
      id_grupo, 
      fecha_inicio, 
      nombre_medicamento, 
      dosis, 
      presentacion, 
      frecuencia, 
      hora_toma,
      intervalo_horas, // Horas entre cada toma (ej. 8)
      repeticiones     // Cantidad total de veces a repetir (ej. 3)
    } = req.body || {};

    const fechaValida = typeof fecha_inicio === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)
      && !Number.isNaN(Date.parse(`${fecha_inicio}T00:00:00`))
      && new Date(`${fecha_inicio}T00:00:00`).toISOString().slice(0, 10) === fecha_inicio;
    const horaValida = typeof hora_toma === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora_toma.trim());
    const repeticionesNumero = repeticiones === undefined || repeticiones === '' ? 1 : Number(repeticiones);
    const intervaloNumero = intervalo_horas === undefined || intervalo_horas === '' ? 0 : Number(intervalo_horas);

    if (!id_grupo || !fechaValida || !nombre_medicamento?.trim() || !dosis?.trim() || !presentacion?.trim() || !horaValida) {
      return res.status(400).json({ error: 'Todos los campos obligatorios del medicamento deben estar completos' });
    }
    if (!Number.isInteger(repeticionesNumero) || repeticionesNumero < 1 || repeticionesNumero > 365
      || !Number.isInteger(intervaloNumero) || intervaloNumero < 0 || intervaloNumero > 168
      || (repeticionesNumero > 1 && intervaloNumero < 1)) {
      return res.status(400).json({ error: 'Las repeticiones deben ser de 1 a 365 y el intervalo de 1 a 168 horas' });
    }

    let horaInicialLimpia = hora_toma.trim();
    if (horaInicialLimpia.length === 5) horaInicialLimpia += ':00';

    await client.query('BEGIN');

    // 1. Insertar el medicamento base
    const medicamento = await client.query(
      `INSERT INTO medicamento (nombre_medicamento, dosis, presentacion, id_grupo)
       VALUES ($1, $2, $3, $4) RETURNING id_medicamento`,
      [nombre_medicamento.trim(), dosis.trim(), presentacion.trim(), id_grupo]
    );

    const idMedicamento = medicamento.rows[0].id_medicamento;
    const numRepeticiones = repeticionesNumero;
    const intervaloHoras = intervaloNumero;

    // 2. Parsear fecha y hora inicial para empezar las iteraciones
    const [anio, mes, dia] = fecha_inicio.trim().split('-').map(Number);
    const [h, m, s] = horaInicialLimpia.split(':').map(Number);
    let fechaHoraBase = new Date(anio, mes - 1, dia, h || 0, m || 0, s || 0);

    let ultimaTomaCreada = null;

    // 3. Bucle para generar cada toma sumando las horas de intervalo
    for (let i = 0; i < numRepeticiones; i++) {
      if (i > 0) {
        fechaHoraBase.setTime(fechaHoraBase.getTime() + (intervaloHoras * 60 * 60 * 1000));
      }

      const fechaActualStr = `${fechaHoraBase.getFullYear()}-${String(fechaHoraBase.getMonth() + 1).padStart(2, '0')}-${String(fechaHoraBase.getDate()).padStart(2, '0')}`;
      const horaActualStr = `${String(fechaHoraBase.getHours()).padStart(2, '0')}:${String(fechaHoraBase.getMinutes()).padStart(2, '0')}:${String(fechaHoraBase.getSeconds()).padStart(2, '0')}`;

      const toma = await client.query(
        `INSERT INTO horario_medicamento (id_medicamento, frecuencia, hora_toma, fecha_toma)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [idMedicamento, frecuencia ? frecuencia.trim() : null, horaActualStr, fechaActualStr]
      );
      ultimaTomaCreada = toma.rows[0];
    }

    await client.query('COMMIT');

    const tomaCompleta = {
      ...ultimaTomaCreada,
      nombre_medicamento: nombre_medicamento.trim(),
      dosis: dosis.trim(),
      presentacion: presentacion.trim(),
      frecuencia: frecuencia ? frecuencia.trim() : null,
      fecha_inicio: fecha_inicio.trim()
    };

    res.status(201).json({ mensaje: 'Tomas creadas exitosamente', toma: tomaCompleta });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error en crearHorarioMedicamento:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
};

const eliminarHorarioMedicamento = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const resultado = await client.query(
      'DELETE FROM horario_medicamento WHERE id_horario_medicamento = $1 RETURNING id_medicamento',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Toma no encontrada' });
    }

    const tomasRestantes = await client.query(
      'SELECT 1 FROM horario_medicamento WHERE id_medicamento = $1 LIMIT 1',
      [resultado.rows[0].id_medicamento]
    );
    if (tomasRestantes.rows.length === 0) {
      await client.query('DELETE FROM medicamento WHERE id_medicamento = $1', [resultado.rows[0].id_medicamento]);
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Toma eliminada exitosamente' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en eliminarHorarioMedicamento:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
};

const actualizarHorarioMedicamento = async (req, res) => {
  let client;
  try {
    const { nombre_medicamento, dosis, presentacion, frecuencia, hora_toma, fecha_inicio } = req.body || {};
    const fechaValida = typeof fecha_inicio === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)
      && !Number.isNaN(Date.parse(`${fecha_inicio}T00:00:00.000Z`))
      && new Date(`${fecha_inicio}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha_inicio;
    if (!nombre_medicamento?.trim() || !dosis?.trim() || !presentacion?.trim()
      || typeof hora_toma !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora_toma)
      || !fechaValida) {
      return res.status(400).json({ error: 'Todos los campos son requeridos para actualizar' });
    }

    let horaFinal = hora_toma.trim();
    if (horaFinal.length === 5) horaFinal += ':00';

    client = await pool.connect();
    await client.query('BEGIN');
    const tomaRes = await client.query(
      'SELECT id_medicamento FROM horario_medicamento WHERE id_horario_medicamento = $1 FOR UPDATE',
      [req.params.id]
    );
    if (tomaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Toma no encontrada' });
    }

    await client.query(
      `UPDATE medicamento
       SET nombre_medicamento = $1, dosis = $2, presentacion = $3
       WHERE id_medicamento = $4`,
      [nombre_medicamento.trim(), dosis.trim(), presentacion.trim(), tomaRes.rows[0].id_medicamento]
    );
    await client.query(
      'UPDATE horario_medicamento SET frecuencia = $1, hora_toma = $2, fecha_toma = $3 WHERE id_horario_medicamento = $4',
      [frecuencia ? frecuencia.trim() : null, horaFinal, fecha_inicio, req.params.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ mensaje: 'Toma actualizada exitosamente' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en actualizarHorarioMedicamento:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
};

const crearHorarioCuidado = async (req, res) => {
  let client;
  try {
    const { id_grupo, id_cuidador, fecha_inicio, fecha_fin, hora_inicio, hora_fin } = req.body || {};
    const fechaValida = (fecha) => typeof fecha === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      && !Number.isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
      && new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
    const horaValida = (hora) => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora);

    if (!Number.isInteger(Number(id_grupo)) || Number(id_grupo) <= 0
      || !Number.isInteger(Number(id_cuidador)) || Number(id_cuidador) <= 0
      || !fechaValida(fecha_inicio) || !fechaValida(fecha_fin)
      || !horaValida(hora_inicio) || !horaValida(hora_fin)) {
      return res.status(400).json({ error: 'Todos los campos del turno son obligatorios' });
    }

    let hInicio = hora_inicio.trim();
    if (hInicio.length === 5) hInicio += ':00';
    let hFin = hora_fin.trim();
    if (hFin.length === 5) hFin += ':00';

    client = await pool.connect();
    await client.query('BEGIN');
    const grupoRes = await client.query('SELECT id_grupo FROM grupo WHERE id_grupo = $1 FOR UPDATE', [id_grupo]);
    if (grupoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const usuarioRes = await client.query(
      `SELECT u.nombre_usuario 
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       LEFT JOIN cuidador c ON c.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND gu.id_usuario = $2
         AND (c.id_usuario IS NOT NULL OR COALESCE(gu.rol, 'cuidador') = 'cuidador')`,
      [id_grupo, id_cuidador]
    );

    if (usuarioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El cuidador seleccionado no existe en este grupo' });
    }

    const nombreEncargado = usuarioRes.rows[0].nombre_usuario;

    const solapadoRes = await client.query(
      `SELECT hc.id_horario_cuidado, hc.encargado
       FROM horario_cuidado hc
       INNER JOIN grupo_usuario gu ON gu.id_usuario = hc.id_cuidador
       WHERE gu.id_grupo = $1
         AND (hc.fecha_inicio + hc.hora_inicio) < ($2::date + $3::time)
         AND (hc.fecha_fin + hc.hora_fin) > ($4::date + $5::time)`,
      [id_grupo, fecha_fin.trim(), hFin, fecha_inicio.trim(), hInicio]
    );

    if (solapadoRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Ya existe un turno de ${solapadoRes.rows[0].encargado} que se traslapa con ese horario en el grupo`,
      });
    }

    await client.query(
      'INSERT INTO cuidador (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING',
      [id_cuidador]
    );

    const nuevoHorario = await client.query(
      `INSERT INTO horario_cuidado (id_cuidador, encargado, hora_inicio, hora_fin, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_cuidador, nombreEncargado, hInicio, hFin, fecha_inicio.trim(), fecha_fin.trim()]
    );
    await client.query('COMMIT');

    const horarioCompleto = {
      ...nuevoHorario.rows[0],
      fecha_inicio: fecha_inicio.trim(),
      fecha_fin: fecha_fin.trim()
    };

    return res.status(201).json({ mensaje: 'Turno creado exitosamente', horario: horarioCompleto });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error al crear horario de cuidado:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
};

const actualizarHorarioCuidado = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { id_grupo, id_cuidador, fecha_inicio, fecha_fin, hora_inicio, hora_fin } = req.body || {};
    const fechaValida = (fecha) => typeof fecha === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      && !Number.isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
      && new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
    const horaValida = (hora) => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora);

    if (!Number.isInteger(Number(id_grupo)) || Number(id_grupo) <= 0
      || !Number.isInteger(Number(id_cuidador)) || Number(id_cuidador) <= 0
      || !fechaValida(fecha_inicio) || !fechaValida(fecha_fin)
      || !horaValida(hora_inicio) || !horaValida(hora_fin)) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios para actualizar el turno' });
    }

    let hInicio = hora_inicio.trim();
    if (hInicio.length === 5) hInicio += ':00';
    let hFin = hora_fin.trim();
    if (hFin.length === 5) hFin += ':00';

    client = await pool.connect();
    await client.query('BEGIN');
    const grupoRes = await client.query('SELECT id_grupo FROM grupo WHERE id_grupo = $1 FOR UPDATE', [id_grupo]);
    if (grupoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const turnoRes = await client.query(
      `SELECT hc.id_horario_cuidado FROM horario_cuidado hc
       INNER JOIN grupo_usuario gu ON gu.id_usuario = hc.id_cuidador
       WHERE hc.id_horario_cuidado = $1 AND gu.id_grupo = $2
       FOR UPDATE OF hc`,
      [id, id_grupo]
    );
    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Turno no encontrado en este grupo' });
    }

    const usuarioRes = await client.query(
      `SELECT u.nombre_usuario 
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       LEFT JOIN cuidador c ON c.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND gu.id_usuario = $2
         AND (c.id_usuario IS NOT NULL OR COALESCE(gu.rol, 'cuidador') = 'cuidador')`,
      [id_grupo, id_cuidador]
    );

    if (usuarioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El cuidador seleccionado no existe en este grupo' });
    }

    const nombreEncargado = usuarioRes.rows[0].nombre_usuario;

    const solapadoRes = await client.query(
      `SELECT hc.id_horario_cuidado, hc.encargado
       FROM horario_cuidado hc
       INNER JOIN grupo_usuario gu ON gu.id_usuario = hc.id_cuidador
       WHERE gu.id_grupo = $1
         AND hc.id_horario_cuidado <> $2
         AND (hc.fecha_inicio + hc.hora_inicio) < ($3::date + $4::time)
         AND (hc.fecha_fin + hc.hora_fin) > ($5::date + $6::time)`,
      [id_grupo, id, fecha_fin.trim(), hFin, fecha_inicio.trim(), hInicio]
    );

    if (solapadoRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Ya existe un turno de ${solapadoRes.rows[0].encargado} que se traslapa con ese horario en el grupo`,
      });
    }

    await client.query(
      'INSERT INTO cuidador (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING',
      [id_cuidador]
    );

    const resultado = await client.query(
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

    if (resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const horarioCompleto = {
      ...resultado.rows[0],
      fecha_inicio: fecha_inicio.trim(),
      fecha_fin: fecha_fin.trim()
    };

    await client.query('COMMIT');
    return res.status(200).json({ mensaje: 'Turno actualizado exitosamente', horario: horarioCompleto });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en actualizarHorarioCuidado:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client?.release();
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
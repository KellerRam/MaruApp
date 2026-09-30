const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const { crearUrlMedia } = require('../utils/mediaAccess');

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const TIPOS = {
  gasto: { tabla: 'gasto', id: 'id_gasto', fecha: 'fecha_gasto', hora: 'hora_gasto' },
  ingreso: { tabla: 'ingreso', id: 'id_ingreso', fecha: 'fecha_ingreso', hora: 'hora_ingreso' },
};

const validarMovimiento = (body) => {
  const { fecha, hora, cantidad, descripcion, id_grupo } = body;
  if (!fecha || !hora || cantidad === undefined || cantidad === '' || !descripcion?.trim() || !id_grupo) {
    return 'Fecha, hora, cantidad, descripción e id_grupo son obligatorios';
  }
  const fechaValida = typeof fecha === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    && !Number.isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
    && new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
  if (!fechaValida || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return 'La fecha debe ser YYYY-MM-DD y la hora HH:MM';
  }
  if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) return 'La cantidad debe ser mayor que cero';
  return null;
};

const obtenerPresupuesto = async (client, idGrupo, fecha) => {
  const intervalo = fecha.slice(0, 7);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`presupuesto:${idGrupo}:${intervalo}`]);
  const existente = await client.query(
    'SELECT id_presupuesto FROM presupuesto WHERE id_grupo = $1 AND intervalo_fecha = $2 LIMIT 1',
    [idGrupo, intervalo]
  );
  if (existente.rows.length) return existente.rows[0].id_presupuesto;
  const nuevo = await client.query(
    'INSERT INTO presupuesto (intervalo_fecha, id_grupo) VALUES ($1, $2) RETURNING id_presupuesto',
    [intervalo, idGrupo]
  );
  return nuevo.rows[0].id_presupuesto;
};

const seleccionarMovimientos = async (idGrupo) => {
  const resultado = await pool.query(
    `SELECT g.id_gasto AS id, 'gasto' AS tipo, TO_CHAR(g.fecha_gasto, 'YYYY-MM-DD') AS fecha, g.hora_gasto AS hora,
            g.cantidad, g.comprobante, g.descripcion, g.id_presupuesto
       FROM gasto g INNER JOIN presupuesto p ON p.id_presupuesto = g.id_presupuesto
      WHERE p.id_grupo = $1
      UNION ALL
     SELECT i.id_ingreso AS id, 'ingreso' AS tipo, TO_CHAR(i.fecha_ingreso, 'YYYY-MM-DD') AS fecha, i.hora_ingreso AS hora,
            i.cantidad, i.comprobante, i.descripcion, i.id_presupuesto
       FROM ingreso i INNER JOIN presupuesto p ON p.id_presupuesto = i.id_presupuesto
      WHERE p.id_grupo = $1
      ORDER BY fecha DESC, hora DESC`,
    [idGrupo]
  );
  return resultado.rows.map((movimiento) => ({
    ...movimiento,
    comprobante: movimiento.comprobante ? crearUrlMedia(movimiento.comprobante) : null,
  }));
};

const listarFinanzas = async (req, res) => {
  try {
    const movimientos = await seleccionarMovimientos(req.params.idGrupo);
    res.status(200).json({ movimientos });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const crearMovimiento = (tipo) => async (req, res) => {
  const definicion = TIPOS[tipo];
  let client;
  try {
    const error = validarMovimiento(req.body);
    if (error) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error });
    }
    const { fecha, hora, cantidad, descripcion, id_grupo } = req.body;
    client = await pool.connect();
    await client.query('BEGIN');
    const idPresupuesto = await obtenerPresupuesto(client, id_grupo, fecha);
    const comprobante = req.file ? `/uploads/${req.file.filename}` : null;
    const resultado = await client.query(
      `INSERT INTO ${definicion.tabla} (${definicion.fecha}, ${definicion.hora}, cantidad, comprobante, descripcion, id_presupuesto)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${definicion.id} AS id, TO_CHAR(${definicion.fecha}, 'YYYY-MM-DD') AS fecha, ${definicion.hora} AS hora, cantidad, comprobante, descripcion, id_presupuesto`,
      [fecha, `${hora}:00`, Number(cantidad), comprobante, descripcion.trim(), idPresupuesto]
    );
    await client.query('COMMIT');
    const movimiento = resultado.rows[0];
    movimiento.comprobante = movimiento.comprobante ? crearUrlMedia(movimiento.comprobante) : null;
    res.status(201).json({ mensaje: `${tipo} registrado`, movimiento: { ...movimiento, tipo } });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Error al crear movimiento financiero:', error.message);
    res.status(500).json({ error: 'No se pudo crear el movimiento' });
  } finally {
    client?.release();
  }
};

const actualizarMovimiento = async (req, res) => {
  let client;
  let transaccionActiva = false;
  let comprobanteAnterior = null;
  try {
    const definicion = TIPOS[req.params.tipo];
    if (!definicion) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    const error = validarMovimiento(req.body);
    if (error) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error });
    }
    const { fecha, hora, cantidad, descripcion } = req.body;
    client = await pool.connect();
    await client.query('BEGIN');
    transaccionActiva = true;

    const registro = await client.query(
      `SELECT movimiento.comprobante FROM ${definicion.tabla} movimiento
       INNER JOIN presupuesto p ON p.id_presupuesto = movimiento.id_presupuesto
       INNER JOIN grupo_usuario gu ON gu.id_grupo = p.id_grupo
       WHERE movimiento.${definicion.id} = $1 AND gu.id_usuario = $2
       FOR UPDATE OF movimiento`,
      [req.params.id, req.usuarioAutenticado.id]
    );
    if (!registro.rows.length) {
      await client.query('ROLLBACK');
      transaccionActiva = false;
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    comprobanteAnterior = registro.rows[0].comprobante;
    const comprobanteNuevo = req.file
      ? `/uploads/${req.file.filename}`
      : comprobanteAnterior || null;

    const resultado = await client.query(
      `UPDATE ${definicion.tabla} AS movimiento
          SET ${definicion.fecha} = $1, ${definicion.hora} = $2, cantidad = $3, comprobante = $4, descripcion = $5
        WHERE ${definicion.id} = $6
          AND EXISTS (
            SELECT 1 FROM presupuesto p
            INNER JOIN grupo_usuario gu ON gu.id_grupo = p.id_grupo
            WHERE p.id_presupuesto = movimiento.id_presupuesto
              AND gu.id_usuario = $7
          )
        RETURNING movimiento.${definicion.id} AS id, TO_CHAR(movimiento.${definicion.fecha}, 'YYYY-MM-DD') AS fecha,
                  movimiento.${definicion.hora} AS hora, movimiento.cantidad, movimiento.comprobante,
                  movimiento.descripcion, movimiento.id_presupuesto`,
      [fecha, `${hora}:00`, Number(cantidad), comprobanteNuevo, descripcion.trim(), req.params.id, req.usuarioAutenticado.id]
    );
    if (!resultado.rows.length) {
      await client.query('ROLLBACK');
      transaccionActiva = false;
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    await client.query('COMMIT');
    transaccionActiva = false;

    if (req.file && comprobanteAnterior && comprobanteAnterior !== comprobanteNuevo) {
      const rutaAnterior = path.resolve(__dirname, '../../', String(comprobanteAnterior).replace(/^[/\\]+/, ''));
      const directorioUploads = path.resolve(__dirname, '../../uploads');
      if (rutaAnterior.startsWith(`${directorioUploads}${path.sep}`)) {
        await fs.promises.unlink(rutaAnterior).catch((error) => {
          if (error.code !== 'ENOENT') console.error('No se pudo limpiar el comprobante anterior:', error.message);
        });
      }
    }
    const movimiento = resultado.rows[0];
    movimiento.comprobante = movimiento.comprobante ? crearUrlMedia(movimiento.comprobante) : null;
    res.status(200).json({ movimiento: { ...movimiento, tipo: req.params.tipo } });
  } catch (error) {
    if (client && transaccionActiva) await client.query('ROLLBACK').catch(() => {});
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Error al actualizar movimiento financiero:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar el movimiento' });
  } finally {
    client?.release();
  }
};

const eliminarMovimiento = async (req, res) => {
  try {
    const definicion = TIPOS[req.params.tipo];
    if (!definicion) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    const { id } = req.params;

    const registroRes = await pool.query(
      `SELECT mov.comprobante FROM ${definicion.tabla} mov
       INNER JOIN presupuesto p ON p.id_presupuesto = mov.id_presupuesto
       INNER JOIN grupo_usuario gu ON gu.id_grupo = p.id_grupo
       WHERE mov.${definicion.id} = $1 AND gu.id_usuario = $2`,
      [id, req.usuarioAutenticado.id]
    );
    if (!registroRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado' });

    const eliminado = await pool.query(
      `DELETE FROM ${definicion.tabla} mov
       USING presupuesto p
       WHERE mov.${definicion.id} = $1
         AND p.id_presupuesto = mov.id_presupuesto
         AND EXISTS (
           SELECT 1 FROM grupo_usuario gu
           WHERE gu.id_grupo = p.id_grupo AND gu.id_usuario = $2
         )
       RETURNING mov.comprobante`,
      [id, req.usuarioAutenticado.id]
    );
    if (!eliminado.rows.length) return res.status(404).json({ error: 'Registro no encontrado' });

    if (eliminado.rows[0].comprobante) {
      const rutaRelativa = String(eliminado.rows[0].comprobante).replace(/^[/\\]+/, '');
      const raizUploads = path.resolve(__dirname, '../../uploads');
      const rutaFisica = path.resolve(__dirname, '../../', rutaRelativa);
      if (rutaFisica.startsWith(`${raizUploads}${path.sep}`)) {
        await fs.promises.unlink(rutaFisica).catch((error) => {
          if (error.code !== 'ENOENT') console.error('No se pudo eliminar el comprobante:', error.message);
        });
      }
    }
    res.status(200).json({ mensaje: 'Registro eliminado correctamente' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const exportarFinanzas = async (req, res) => {
  try {
    const movimientos = await seleccionarMovimientos(req.params.idGrupo);
    const mes = req.query.mes;
    const filas = mes ? movimientos.filter((item) => String(item.fecha).trim().slice(0, 7) === String(mes).trim()) : movimientos;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="finanzas.pdf"');

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text(`Reporte de Finanzas - ${mes || 'General'}`, { underline: true });
    doc.moveDown();

    if (!filas.length) {
      doc.fontSize(12).text('No hay movimientos registrados para este período.');
    } else {
      filas.forEach((item, index) => {
        doc.fontSize(10).text(`${index + 1}. Fecha: ${item.fecha} | Tipo: ${item.tipo.toUpperCase()} | Monto: Q${Number(item.cantidad).toFixed(2)}`);
        doc.text(`   Descripción: ${item.descripcion}`);
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (error) { 
    if (!res.headersSent) {
      res.status(500).json({ error: error.message }); 
    }
  }
};

module.exports = { listarFinanzas, crearMovimiento, actualizarMovimiento, eliminarMovimiento, exportarFinanzas };
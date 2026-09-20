const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return 'La fecha debe ser YYYY-MM-DD y la hora HH:MM';
  }
  if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) return 'La cantidad debe ser mayor que cero';
  return null;
};

const obtenerPresupuesto = async (idGrupo, fecha) => {
  const intervalo = fecha.slice(0, 7);
  const existente = await pool.query(
    'SELECT id_presupuesto FROM presupuesto WHERE id_grupo = $1 AND intervalo_fecha = $2 LIMIT 1',
    [idGrupo, intervalo]
  );
  if (existente.rows.length) return existente.rows[0].id_presupuesto;
  const nuevo = await pool.query(
    'INSERT INTO presupuesto (intervalo_fecha, id_grupo) VALUES ($1, $2) RETURNING id_presupuesto',
    [intervalo, idGrupo]
  );
  return nuevo.rows[0].id_presupuesto;
};

const seleccionarMovimientos = async (idGrupo) => {
  const resultado = await pool.query(
    `SELECT g.id_gasto AS id, 'gasto' AS tipo, g.fecha_gasto AS fecha, g.hora_gasto AS hora,
            g.cantidad, g.comprobante, g.descripcion, g.id_presupuesto
       FROM gasto g INNER JOIN presupuesto p ON p.id_presupuesto = g.id_presupuesto
      WHERE p.id_grupo = $1
      UNION ALL
     SELECT i.id_ingreso AS id, 'ingreso' AS tipo, i.fecha_ingreso AS fecha, i.hora_ingreso AS hora,
            i.cantidad, i.comprobante, i.descripcion, i.id_presupuesto
       FROM ingreso i INNER JOIN presupuesto p ON p.id_presupuesto = i.id_presupuesto
      WHERE p.id_grupo = $1
      ORDER BY fecha DESC, hora DESC`,
    [idGrupo]
  );
  return resultado.rows;
};

const listarFinanzas = async (req, res) => {
  try {
    const movimientos = await seleccionarMovimientos(req.params.idGrupo);
    res.status(200).json({ movimientos });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const crearMovimiento = (tipo) => async (req, res) => {
  const definicion = TIPOS[tipo];
  try {
    const error = validarMovimiento(req.body);
    if (error) return res.status(400).json({ error });
    const { fecha, hora, cantidad, descripcion, id_grupo } = req.body;
    const idPresupuesto = await obtenerPresupuesto(id_grupo, fecha);
    const comprobante = req.file ? `/uploads/${req.file.filename}` : null;
    const resultado = await pool.query(
      `INSERT INTO ${definicion.tabla} (${definicion.fecha}, ${definicion.hora}, cantidad, comprobante, descripcion, id_presupuesto)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${definicion.id} AS id, ${definicion.fecha} AS fecha, ${definicion.hora} AS hora, cantidad, comprobante, descripcion, id_presupuesto`,
      [fecha, `${hora}:00`, Number(cantidad), comprobante, descripcion.trim(), idPresupuesto]
    );
    res.status(201).json({ mensaje: `${tipo} registrado`, movimiento: { ...resultado.rows[0], tipo } });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const actualizarMovimiento = async (req, res) => {
  try {
    const definicion = TIPOS[req.params.tipo];
    if (!definicion) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    const error = validarMovimiento(req.body);
    if (error) return res.status(400).json({ error });
    const { fecha, hora, cantidad, descripcion } = req.body;
    const comprobante = req.file ? `/uploads/${req.file.filename}` : req.body.comprobante || null;
    const resultado = await pool.query(
      `UPDATE ${definicion.tabla}
          SET ${definicion.fecha} = $1, ${definicion.hora} = $2, cantidad = $3, comprobante = $4, descripcion = $5
        WHERE ${definicion.id} = $6
        RETURNING ${definicion.id} AS id, ${definicion.fecha} AS fecha, ${definicion.hora} AS hora, cantidad, comprobante, descripcion, id_presupuesto`,
      [fecha, `${hora}:00`, Number(cantidad), comprobante, descripcion.trim(), req.params.id]
    );
    if (!resultado.rows.length) return res.status(404).json({ error: 'Registro no encontrado' });
    res.status(200).json({ movimiento: { ...resultado.rows[0], tipo: req.params.tipo } });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const exportarFinanzas = async (req, res) => {
  try {
    const movimientos = await seleccionarMovimientos(req.params.idGrupo);
    const mes = req.query.mes;
    const filas = mes ? movimientos.filter((item) => String(item.fecha).slice(0, 7) === mes) : movimientos;
    const formato = req.query.formato || 'xls';
    if (formato === 'xls') {
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Finanzas');
      const archivo = XLSX.write(libro, { type: 'buffer', bookType: 'xls' });
      res.setHeader('Content-Disposition', 'attachment; filename="finanzas.xls"');
      res.type('application/vnd.ms-excel').send(archivo);
      return;
    }
    const documento = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Disposition', 'attachment; filename="finanzas.pdf"');
    res.type('application/pdf');
    documento.pipe(res);
    documento.fontSize(18).text(`Finanzas ${mes || ''}`, { underline: true }).moveDown();
    filas.forEach((item) => documento.fontSize(10).text(`${item.fecha} ${String(item.hora).slice(0, 5)} | ${item.tipo.toUpperCase()} | $${item.cantidad} | ${item.descripcion}`));
    documento.end();
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = { listarFinanzas, crearMovimiento, actualizarMovimiento, exportarFinanzas };
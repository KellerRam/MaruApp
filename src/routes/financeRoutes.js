const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { listarFinanzas, crearMovimiento, actualizarMovimiento, eliminarMovimiento, exportarFinanzas } = require('../controllers/financeController');

const router = express.Router();
const { requireAuth, requireGroupMember } = require('../middleware/auth');
const EXTENSIONES_COMPROBANTE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${EXTENSIONES_COMPROBANTE[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!EXTENSIONES_COMPROBANTE[file.mimetype]) {
      const error = new Error('El comprobante debe ser una imagen JPEG, PNG, WebP o HEIC');
      error.statusCode = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

const subirComprobante = (req, res, next) => upload.single('comprobante')(req, res, (error) => {
  if (!error) return next();
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.statusCode || 400;
  return res.status(status).json({
    error: status === 413 ? 'El comprobante supera el límite de 5 MB' : error.message || 'Comprobante no válido',
  });
});

router.use(requireAuth);

router.get('/group/:idGrupo', requireGroupMember(), listarFinanzas);
router.get('/group/:idGrupo/export', requireGroupMember(), exportarFinanzas);
router.post('/gasto', subirComprobante, requireGroupMember(), crearMovimiento('gasto'));
router.post('/ingreso', subirComprobante, requireGroupMember(), crearMovimiento('ingreso'));
router.put('/:tipo/:id', subirComprobante, actualizarMovimiento);
router.delete('/:tipo/:id', eliminarMovimiento);

module.exports = router;
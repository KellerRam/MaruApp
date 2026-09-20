const express = require('express');
const multer = require('multer');
const path = require('path');
const { listarFinanzas, crearMovimiento, actualizarMovimiento, exportarFinanzas } = require('../controllers/financeController');

const router = express.Router();
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, /^image\//.test(file.mimetype)),
});

router.get('/group/:idGrupo', listarFinanzas);
router.get('/group/:idGrupo/export', exportarFinanzas);
router.post('/gasto', upload.single('comprobante'), crearMovimiento('gasto'));
router.post('/ingreso', upload.single('comprobante'), crearMovimiento('ingreso'));
router.put('/:tipo/:id', upload.single('comprobante'), actualizarMovimiento);

module.exports = router;
const express = require('express');
const {
  obtenerRol,
  obtenerPreferencias,
  actualizarBienestar,
  guardarTokenPush,
  eliminarTokenPush,
  confirmarAlerta,
} = require('../controllers/notificationController');

const router = express.Router();
const { requireAuth, requireOwnParam, requireOwnBody } = require('../middleware/auth');

router.use(requireAuth);

router.get('/role/:id_usuario', requireOwnParam('id_usuario'), obtenerRol);
router.get('/preferences/:id_usuario', requireOwnParam('id_usuario'), obtenerPreferencias);
router.put('/bienestar/:id_usuario', requireOwnParam('id_usuario'), actualizarBienestar);
router.post('/push-token/:id_usuario', requireOwnParam('id_usuario'), guardarTokenPush);
router.delete('/push-token/:id_usuario', requireOwnParam('id_usuario'), eliminarTokenPush);
router.post('/confirmar', requireOwnBody('id_usuario'), confirmarAlerta);

module.exports = router;

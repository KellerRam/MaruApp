const express = require('express');
const {
  obtenerPreferencias,
  actualizarBienestar,
  guardarTokenPush,
  eliminarTokenPush,
  solicitarAlertaBienestar,
  confirmarAlerta,
} = require('../controllers/notificationController');

const router = express.Router();
const { requireAuth, requireOwnParam, requireOwnBody, requireGroupMember } = require('../middleware/auth');

router.use(requireAuth);

router.get('/preferences/:id_usuario', requireOwnParam('id_usuario'), obtenerPreferencias);
router.put('/bienestar/:id_usuario', requireOwnParam('id_usuario'), actualizarBienestar);
router.post('/push-token/:id_usuario', requireOwnParam('id_usuario'), guardarTokenPush);
router.delete('/push-token/:id_usuario', requireOwnParam('id_usuario'), eliminarTokenPush);
router.post('/bienestar/solicitar', requireOwnBody('id_usuario'), requireGroupMember(), solicitarAlertaBienestar);
router.post('/confirmar', requireOwnBody('id_usuario'), confirmarAlerta);

module.exports = router;

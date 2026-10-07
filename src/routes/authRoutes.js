// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { solicitarCodigo, registrarUsuario, verificarCodigo, completarPerfil, loginUsuario, socialLoginUsuario, obtenerPerfilUsuario, actualizarPerfilUsuario, eliminarCuentaUsuario, solicitarRecuperacionPassword, verificarCodigoRecuperacion, restablecerPassword } = require('../controllers/authController');
const { requireAuth, requireOwnParam } = require('../middleware/auth');

router.post('/signup', registrarUsuario);
router.post('/request-code', solicitarCodigo);
router.post('/verify', verificarCodigo);
router.post('/complete-profile', completarPerfil);
router.post('/login', loginUsuario);
router.post('/social-login', socialLoginUsuario);
router.post('/forgot-password', solicitarRecuperacionPassword);
router.post('/verify-reset-code', verificarCodigoRecuperacion);
router.post('/reset-password', restablecerPassword);
router.get('/user/:idUsuario', requireAuth, requireOwnParam(), obtenerPerfilUsuario);
router.put('/user/:idUsuario', requireAuth, requireOwnParam(), actualizarPerfilUsuario);
router.delete('/user/:idUsuario', requireAuth, requireOwnParam(), eliminarCuentaUsuario);

module.exports = router;
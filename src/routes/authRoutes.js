// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registrarUsuario, verificarCodigo, completarPerfil, loginUsuario, socialLoginUsuario, obtenerPerfilUsuario, actualizarPerfilUsuario } = require('../controllers/authController');

router.post('/signup', registrarUsuario);
router.post('/verify', verificarCodigo);
router.post('/complete-profile', completarPerfil);
router.post('/login', loginUsuario);
router.post('/social-login', socialLoginUsuario);
router.get('/user/:idUsuario', obtenerPerfilUsuario);
router.put('/user/:idUsuario', actualizarPerfilUsuario);

module.exports = router;
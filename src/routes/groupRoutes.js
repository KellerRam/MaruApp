// src/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const { crearGrupo, obtenerGrupoUsuario, obtenerMiembrosGrupo, crearInvitacionGrupo, unirseAGrupo, actualizarRolMiembro, eliminarMiembroGrupo } = require('../controllers/groupController');

router.post('/create', crearGrupo);
router.get('/user/:idUsuario', obtenerGrupoUsuario);
router.get('/:idGrupo/members', obtenerMiembrosGrupo);
router.post('/:idGrupo/invite', crearInvitacionGrupo);
router.post('/join', unirseAGrupo);
router.put('/:idGrupo/members/:idUsuario/role', actualizarRolMiembro);
router.delete('/:idGrupo/members/:idUsuario', eliminarMiembroGrupo);

module.exports = router;
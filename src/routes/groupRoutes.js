// src/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const { crearGrupo, obtenerGrupoUsuario, obtenerMiembrosGrupo, crearPacienteManual, crearInvitacionGrupo, unirseAGrupo, actualizarRolMiembro, eliminarMiembroGrupo } = require('../controllers/groupController');
const { requireAuth, requireOwnParam, requireOwnBody, requireGroupMember, requireGroupCaregiver } = require('../middleware/auth');

router.use(requireAuth);

router.post('/create', requireOwnBody('idUsuario'), crearGrupo);
router.post('/join', requireOwnBody('idUsuario'), unirseAGrupo);
router.get('/user/:idUsuario', requireOwnParam(), obtenerGrupoUsuario);
router.get('/:idGrupo/members', requireGroupMember(), obtenerMiembrosGrupo);
router.post('/:idGrupo/patients/manual', requireOwnBody('idUsuario'), requireGroupCaregiver(), crearPacienteManual);
router.post('/:idGrupo/invite', requireOwnBody('idUsuario'), requireGroupCaregiver(), crearInvitacionGrupo);
router.put('/:idGrupo/members/:idUsuario/role', requireGroupCaregiver(), actualizarRolMiembro);
router.delete('/:idGrupo/members/:idUsuario', requireGroupCaregiver(), eliminarMiembroGrupo);

module.exports = router;
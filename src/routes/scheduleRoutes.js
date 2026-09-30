// src/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireGroupMember, requireGroupCaregiver, requireRelatedGroupMember, requireAuthorizedGroupBody } = require('../middleware/auth');
const {
  obtenerHorariosYEventos,
  crearHorarioCuidado,
  crearHorarioMedicamento,
  actualizarHorarioMedicamento,
  actualizarHorarioCuidado,
  eliminarHorarioCuidado,
  eliminarHorarioMedicamento
} = require('../controllers/scheduleController');

router.use(requireAuth);

router.get('/:idGrupo', requireGroupMember(), obtenerHorariosYEventos);
router.post('/cuidado', requireGroupCaregiver(), crearHorarioCuidado);
router.post('/medicamento', requireGroupCaregiver(), crearHorarioMedicamento);
router.put('/medicamento/:id', requireRelatedGroupMember(
  `SELECT m.id_grupo FROM horario_medicamento hm
   INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento
   WHERE hm.id_horario_medicamento = $1`
), requireGroupCaregiver((req) => req.idGrupoAutorizado), actualizarHorarioMedicamento);
router.put('/cuidado/:id', requireRelatedGroupMember(
  `SELECT gu.id_grupo FROM horario_cuidado hc
   INNER JOIN grupo_usuario gu ON gu.id_usuario = hc.id_cuidador
   WHERE hc.id_horario_cuidado = $1`
), requireAuthorizedGroupBody(), requireGroupCaregiver((req) => req.idGrupoAutorizado), actualizarHorarioCuidado);
router.delete('/cuidado/:id', requireRelatedGroupMember(
  `SELECT gu.id_grupo FROM horario_cuidado hc
   INNER JOIN grupo_usuario gu ON gu.id_usuario = hc.id_cuidador
   WHERE hc.id_horario_cuidado = $1`
), requireGroupCaregiver((req) => req.idGrupoAutorizado), eliminarHorarioCuidado);
router.delete('/medicamento/:id', requireRelatedGroupMember(
  `SELECT m.id_grupo FROM horario_medicamento hm
   INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento
   WHERE hm.id_horario_medicamento = $1`
), requireGroupCaregiver((req) => req.idGrupoAutorizado), eliminarHorarioMedicamento);

module.exports = router;
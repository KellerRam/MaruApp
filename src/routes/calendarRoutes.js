// src/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireGroupMember, requireRelatedGroupMember } = require('../middleware/auth');
const {
  obtenerCalendarioYEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento
} = require('../controllers/calendarController');

router.use(requireAuth);

router.get('/group/:idGrupo', requireGroupMember(), obtenerCalendarioYEventos);
router.post('/events', requireRelatedGroupMember(
  'SELECT id_grupo FROM calendario WHERE id_calendario = $1',
  (req) => req.body?.id_calendario
), crearEvento);
router.put('/events/:id', requireRelatedGroupMember(
  'SELECT c.id_grupo FROM evento e INNER JOIN calendario c ON c.id_calendario = e.id_calendario WHERE e.id_evento = $1'
), actualizarEvento);
router.delete('/events/:id', requireRelatedGroupMember(
  'SELECT c.id_grupo FROM evento e INNER JOIN calendario c ON c.id_calendario = e.id_calendario WHERE e.id_evento = $1'
), eliminarEvento);

module.exports = router;

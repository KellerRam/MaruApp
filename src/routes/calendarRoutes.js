// src/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const {
  obtenerCalendarioYEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento
} = require('../controllers/calendarController');

// Obtener calendario y eventos de un grupo
router.get('/group/:idGrupo', obtenerCalendarioYEventos);

// Crear nuevo evento
router.post('/events', crearEvento);
router.put('/events/:id', actualizarEvento);
router.delete('/events/:id', eliminarEvento);

module.exports = router;

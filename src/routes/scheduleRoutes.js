// src/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const {
  obtenerHorariosYEventos,
  crearHorarioCuidado,
  crearHorarioMedicamento,
  actualizarHorarioMedicamento,
  actualizarHorarioCuidado,
  eliminarHorarioCuidado,
  eliminarHorarioMedicamento
} = require('../controllers/scheduleController');

router.get('/:idGrupo', obtenerHorariosYEventos);
router.post('/cuidado', crearHorarioCuidado);
router.post('/medicamento', crearHorarioMedicamento);
router.put('/medicamento/:id', actualizarHorarioMedicamento);
router.put('/cuidado/:id', actualizarHorarioCuidado);
router.delete('/cuidado/:id', eliminarHorarioCuidado);
router.delete('/medicamento/:id', eliminarHorarioMedicamento);

module.exports = router;
const express = require('express');
const { activarEmergencia, activarEmergenciaPorSensor } = require('../controllers/emergencyController');

const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/group/:idGrupo', activarEmergencia);
router.post('/trigger', activarEmergenciaPorSensor);

module.exports = router;

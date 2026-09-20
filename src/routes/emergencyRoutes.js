const express = require('express');
const { activarEmergencia } = require('../controllers/emergencyController');

const router = express.Router();

router.post('/group/:idGrupo', activarEmergencia);

module.exports = router;

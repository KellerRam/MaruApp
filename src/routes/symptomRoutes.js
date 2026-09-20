const express = require('express');
const { crearSintoma } = require('../controllers/symptomController');

const router = express.Router();

router.post('/', crearSintoma);

module.exports = router;

const express = require('express');
const { 
  crearSintoma, 
  obtenerSintomas, 
  actualizarSintoma, 
  eliminarSintoma 
} = require('../controllers/symptomController');

const router = express.Router();
const { requireAuth, requireOwnParam, requireRelatedGroupMember } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', crearSintoma);
router.get('/:idUsuario', requireOwnParam(), obtenerSintomas);
router.put('/:idSintoma', requireAuth, actualizarSintoma);
router.delete('/:idSintoma', requireAuth, eliminarSintoma);

module.exports = router;
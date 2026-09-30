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
router.put('/:idSintoma', requireRelatedGroupMember(
  'SELECT gu.id_grupo FROM sintoma s INNER JOIN grupo_usuario gu ON gu.id_usuario = s.id_usuario WHERE s.id_sintoma = $1'
), actualizarSintoma);
router.delete('/:idSintoma', requireRelatedGroupMember(
  'SELECT gu.id_grupo FROM sintoma s INNER JOIN grupo_usuario gu ON gu.id_usuario = s.id_usuario WHERE s.id_sintoma = $1'
), eliminarSintoma);

module.exports = router;
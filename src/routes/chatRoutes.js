const express = require('express');
const multer = require('multer');
const path = require('path');
const { listarMensajes, crearMensaje, directorioChat } = require('../controllers/chatController');

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, directorioChat),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '');
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/group/:idGrupo/messages', listarMensajes);
router.post('/group/:idGrupo/messages', upload.single('archivo'), crearMensaje);

module.exports = router;

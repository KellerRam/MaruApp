const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { listarMensajes, crearMensaje, eliminarMensaje, directorioChat } = require('../controllers/chatController');

const router = express.Router();
const { requireAuth, requireGroupMember } = require('../middleware/auth');
const EXTENSIONES_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods',
  'application/vnd.oasis.opendocument.presentation': '.odp',
  'application/rtf': '.rtf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/vnd.rar': '.rar',
  'application/x-7z-compressed': '.7z',
  'application/gzip': '.gz',
  'application/octet-stream': '',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/rtf': '.rtf',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, directorioChat),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${EXTENSIONES_POR_TIPO[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!Object.prototype.hasOwnProperty.call(EXTENSIONES_POR_TIPO, file.mimetype)) {
      const error = new Error('Tipo de archivo no permitido');
      error.statusCode = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

const subirArchivo = (req, res, next) => upload.single('archivo')(req, res, (error) => {
  if (!error) return next();
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.statusCode || 400;
  return res.status(status).json({
    error: status === 413 ? 'El archivo supera el límite de 25 MB' : error.message || 'Archivo no válido',
  });
});

router.use(requireAuth);

router.get('/group/:idGrupo/messages', requireGroupMember(), listarMensajes);
router.post('/group/:idGrupo/messages', requireGroupMember(), subirArchivo, crearMensaje);
router.delete('/messages/:idMensaje', eliminarMensaje);

module.exports = router;

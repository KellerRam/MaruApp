const path = require('path');
const jwt = require('jsonwebtoken');

const uploadsRoot = path.resolve(__dirname, '../../uploads');

const crearUrlMedia = (rutaGuardada) => {
  if (typeof rutaGuardada !== 'string' || !rutaGuardada.startsWith('/uploads/')) return null;
  const rutaRelativa = rutaGuardada.slice('/uploads/'.length);
  const archivo = path.resolve(uploadsRoot, rutaRelativa);
  if (!archivo.startsWith(`${uploadsRoot}${path.sep}`)) return null;

  const token = jwt.sign(
    { alcance: 'archivo', ruta: path.relative(uploadsRoot, archivo) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `/api/media/${token}`;
};

const servirMedia = (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'La autenticación de archivos no está configurada' });
  }

  try {
    const payload = jwt.verify(req.params.token, process.env.JWT_SECRET);
    if (payload.alcance !== 'archivo' || typeof payload.ruta !== 'string') {
      return res.status(403).json({ error: 'Enlace de archivo no válido' });
    }

    const archivo = path.resolve(uploadsRoot, payload.ruta);
    if (!archivo.startsWith(`${uploadsRoot}${path.sep}`)) {
      return res.status(403).json({ error: 'Enlace de archivo no válido' });
    }

    return res.sendFile(archivo, { dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode === 404 ? 404 : 500).json({ error: 'No se pudo obtener el archivo' });
      }
    });
  } catch {
    return res.status(401).json({ error: 'El enlace de archivo expiró o no es válido' });
  }
};

module.exports = { crearUrlMedia, servirMedia };

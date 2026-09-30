const jwt = require('jsonwebtoken');
const fs = require('fs');
const pool = require('../config/db');

const limpiarArchivoSubido = async (req) => {
  if (!req.file?.path) return;
  try {
    await fs.promises.unlink(req.file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo limpiar la carga rechazada:', error.message);
  }
};

const requireAuth = (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'La autenticación no está configurada en el servidor' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(401).json({ error: 'La sesión no es válida' });
    }
    req.usuarioAutenticado = { id, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'La sesión no es válida o ha expirado' });
  }
};

const requireOwnParam = (paramName = 'idUsuario') => (req, res, next) => {
  if (Number(req.params[paramName]) !== req.usuarioAutenticado.id) {
    return res.status(403).json({ error: 'No tienes permiso para acceder a este usuario' });
  }
  return next();
};

const requireOwnBody = (fieldName) => (req, res, next) => {
  if (Number(req.body?.[fieldName]) !== req.usuarioAutenticado.id) {
    return res.status(403).json({ error: 'La sesión no coincide con el usuario indicado' });
  }
  return next();
};

const requireOwnQuery = (fieldName) => (req, res, next) => {
  if (Number(req.query?.[fieldName]) !== req.usuarioAutenticado.id) {
    return res.status(403).json({ error: 'La sesión no coincide con el usuario indicado' });
  }
  return next();
};

const requireGroupMember = (obtenerIdGrupo = (req) => req.params.idGrupo || req.body?.id_grupo || req.body?.idGrupo) => async (req, res, next) => {
  const idGrupo = obtenerIdGrupo(req);
  if (!/^\d+$/.test(String(idGrupo || ''))) {
    await limpiarArchivoSubido(req);
    return res.status(400).json({ error: 'El ID de grupo es inválido' });
  }

  try {
    const resultado = await pool.query(
      'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
      [idGrupo, req.usuarioAutenticado.id]
    );
    if (resultado.rows.length === 0) {
      await limpiarArchivoSubido(req);
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }
    return next();
  } catch (error) {
    await limpiarArchivoSubido(req);
    console.error('Error al verificar pertenencia al grupo:', error.message);
    return res.status(500).json({ error: 'No se pudo validar el acceso al grupo' });
  }
};

const requireRelatedGroupMember = (query, obtenerId = (req) => req.params.id) => async (req, res, next) => {
  try {
    const registro = await pool.query(query, [obtenerId(req)]);
    const idGrupo = registro.rows[0]?.id_grupo;
    if (!idGrupo) return res.status(404).json({ error: 'Registro no encontrado' });

    const miembro = await pool.query(
      'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
      [idGrupo, req.usuarioAutenticado.id]
    );
    if (miembro.rows.length === 0) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    req.idGrupoAutorizado = idGrupo;
    return next();
  } catch (error) {
    console.error('Error al verificar acceso al registro:', error.message);
    return res.status(500).json({ error: 'No se pudo validar el acceso al registro' });
  }
};

const requireGroupCaregiver = (obtenerIdGrupo = (req) => req.params.idGrupo || req.body?.id_grupo || req.body?.idGrupo) => async (req, res, next) => {
  const idGrupo = obtenerIdGrupo(req);
  if (!/^\d+$/.test(String(idGrupo || ''))) {
    return res.status(400).json({ error: 'El ID de grupo es inválido' });
  }

  try {
    const resultado = await pool.query(
      `SELECT 1 FROM grupo_usuario gu
       LEFT JOIN cuidador c ON c.id_usuario = gu.id_usuario
       LEFT JOIN paciente p ON p.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND gu.id_usuario = $2 AND p.id_usuario IS NULL
         AND (c.id_usuario IS NOT NULL OR COALESCE(gu.rol, 'cuidador') = 'cuidador')`,
      [idGrupo, req.usuarioAutenticado.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(403).json({ error: 'Solo un cuidador del grupo puede realizar esta acción' });
    }
    return next();
  } catch (error) {
    console.error('Error al validar el rol del grupo:', error.message);
    return res.status(500).json({ error: 'No se pudo validar el acceso al grupo' });
  }
};

const requireAuthorizedGroupBody = (fieldName = 'id_grupo') => (req, res, next) => {
  if (Number(req.body?.[fieldName]) !== Number(req.idGrupoAutorizado)) {
    return res.status(403).json({ error: 'El grupo indicado no coincide con el registro autorizado' });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireOwnParam,
  requireOwnBody,
  requireOwnQuery,
  requireGroupMember,
  requireGroupCaregiver,
  requireRelatedGroupMember,
  requireAuthorizedGroupBody,
};

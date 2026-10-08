// src/controllers/groupController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const crearGrupo = async (req, res) => {
  const { nombreGrupo, idUsuario } = req.body;

  if (!nombreGrupo || !idUsuario) {
    return res.status(400).json({ error: 'El nombre del grupo y el usuario son obligatorios' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const usuarioRes = await client.query(
      'SELECT id_usuario FROM usuario WHERE id_usuario = $1',
      [idUsuario]
    );

    if (usuarioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'La sesión no corresponde a un usuario válido. Inicia sesión nuevamente.' });
    }

    const nuevoGrupoRes = await client.query(
      'INSERT INTO Grupo (nombre_grupo) VALUES ($1) RETURNING id_grupo',
      [nombreGrupo]
    );
    const idGrupo = nuevoGrupoRes.rows[0].id_grupo;

    await client.query(
      'INSERT INTO Grupo_Usuario (id_usuario, id_grupo) VALUES ($1, $2)',
      [idUsuario, idGrupo]
    );

    await client.query(
      'INSERT INTO cuidador (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING',
      [idUsuario]
    );

    // Crear el calendario único para el grupo
    const calRes = await client.query(
      'INSERT INTO Calendario (fecha, id_grupo) VALUES (CURRENT_DATE, $1) RETURNING id_calendario',
      [idGrupo]
    );
    const idCalendario = calRes.rows[0]?.id_calendario;

    await client.query('COMMIT');

    res.status(201).json({ mensaje: 'Grupo creado exitosamente', idGrupo, nombreGrupo, idCalendario });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const obtenerGrupoUsuario = async (req, res) => {
  try {
    const { idUsuario } = req.params;

    if (!idUsuario) {
      return res.status(400).json({ error: 'El ID de usuario es obligatorio' });
    }

    const resultado = await pool.query(
      `SELECT gu.id_grupo, gu.id_usuario, g.nombre_grupo 
       FROM grupo_usuario gu
       INNER JOIN grupo g ON gu.id_grupo = g.id_grupo
       WHERE gu.id_usuario = $1`,
      [idUsuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(200).json({ tieneGrupo: false, grupo: null });
    }

    res.status(200).json({
      tieneGrupo: true,
      grupo: resultado.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerMiembrosGrupo = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT DISTINCT ON (u.id_usuario) 
              u.id_usuario,
              u.nombre_usuario AS nombre,
              (u.correo IS NULL) AS es_manual,
              CASE WHEN p.id_usuario IS NOT NULL THEN 'paciente'
                   WHEN c.id_usuario IS NOT NULL THEN 'cuidador'
                   ELSE COALESCE(gu.rol, 'cuidador') END AS rol
       FROM grupo_usuario gu
       INNER JOIN usuario u ON gu.id_usuario = u.id_usuario
       LEFT JOIN paciente p ON p.id_usuario = u.id_usuario
       LEFT JOIN cuidador c ON c.id_usuario = u.id_usuario
       WHERE gu.id_grupo = $1
       ORDER BY u.id_usuario, u.nombre_usuario ASC`,
      [req.params.idGrupo]
    );

    res.status(200).json({ miembros: resultado.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearPacienteManual = async (req, res) => {
  const { idGrupo } = req.params;
  const { idUsuario, nombre, genero, fechaNacimiento } = req.body || {};
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  const fechaValida = typeof fechaNacimiento === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)
    && !Number.isNaN(Date.parse(`${fechaNacimiento}T00:00:00.000Z`))
    && new Date(`${fechaNacimiento}T00:00:00.000Z`).toISOString().slice(0, 10) === fechaNacimiento
    && fechaNacimiento <= new Date().toISOString().slice(0, 10);

  if (!/^\d+$/.test(idGrupo) || !Number.isInteger(Number(idUsuario)) || !nombreLimpio || nombreLimpio.length > 100
    || !['Masculino', 'Femenino', 'Otro'].includes(genero) || !fechaValida) {
    return res.status(400).json({ error: 'Nombre, género y fecha de nacimiento válidos son obligatorios' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const grupo = await client.query('SELECT id_grupo FROM grupo WHERE id_grupo = $1 FOR UPDATE', [idGrupo]);
    if (grupo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El grupo no existe' });
    }

    const creador = await client.query(
      'SELECT rol FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2 FOR UPDATE',
      [idGrupo, idUsuario]
    );
    if (creador.rows.length === 0 || creador.rows[0].rol === 'paciente') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Solo un cuidador del grupo puede agregar un paciente' });
    }

    const pacienteExistente = await client.query(
      `SELECT id_usuario FROM grupo_usuario
       WHERE id_grupo = $1 AND rol = 'paciente'
       LIMIT 1`,
      [idGrupo]
    );
    if (pacienteExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este grupo ya tiene un paciente' });
    }

    const passwordAleatoria = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(passwordAleatoria, 10);
    const usuario = await client.query(
      `INSERT INTO usuario (nombre_usuario, password_usuario, fecha_nacimiento_usuario, genero, correo)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id_usuario`,
      [nombreLimpio, passwordHash, fechaNacimiento, genero]
    );
    const idPaciente = usuario.rows[0].id_usuario;

    await client.query('INSERT INTO paciente (id_usuario) VALUES ($1)', [idPaciente]);
    await client.query(
      "INSERT INTO grupo_usuario (id_usuario, id_grupo, rol) VALUES ($1, $2, 'paciente')",
      [idPaciente, idGrupo]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      mensaje: 'Paciente agregado al grupo',
      miembro: { id_usuario: idPaciente, nombre: nombreLimpio, rol: 'paciente' }
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este grupo ya tiene un paciente' });
    }
    console.error('Error al agregar paciente manual:', error);
    return res.status(500).json({ error: 'No se pudo agregar el paciente' });
  } finally {
    client?.release();
  }
};

const crearInvitacionGrupo = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const { idUsuario } = req.body;
    const miembroRes = await pool.query(
      'SELECT 1 FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2',
      [idGrupo, idUsuario]
    );

    if (miembroRes.rows.length === 0) {
      return res.status(403).json({ error: 'No perteneces a este grupo' });
    }

    const token = jwt.sign(
      { idGrupo: Number(idGrupo), tipo: 'invitacion-grupo' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unirseAGrupo = async (req, res) => {
  try {
    const { token, idUsuario } = req.body;
    if (!token || !idUsuario) {
      return res.status(400).json({ error: 'El enlace de invitación y el usuario son obligatorios' });
    }

    const invitacion = jwt.verify(token, process.env.JWT_SECRET);
    if (invitacion.tipo !== 'invitacion-grupo') {
      return res.status(400).json({ error: 'Enlace de invitación inválido' });
    }

    const grupoRes = await pool.query('SELECT id_grupo FROM grupo WHERE id_grupo = $1', [invitacion.idGrupo]);
    if (grupoRes.rows.length === 0) {
      return res.status(404).json({ error: 'El grupo ya no existe' });
    }

    const miembroRes = await pool.query(
      'SELECT id_grupo FROM grupo_usuario WHERE id_usuario = $1',
      [idUsuario]
    );
    if (miembroRes.rows.length > 0) {
      if (Number(miembroRes.rows[0].id_grupo) === Number(invitacion.idGrupo)) {
        return res.status(200).json({ mensaje: 'Ya perteneces a este grupo', idGrupo: invitacion.idGrupo });
      }
      return res.status(409).json({ error: 'Ya perteneces a otro grupo' });
    }

    await pool.query(
      'INSERT INTO grupo_usuario (id_usuario, id_grupo) VALUES ($1, $2)',
      [idUsuario, invitacion.idGrupo]
    );

    await pool.query(
      'INSERT INTO cuidador (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING',
      [idUsuario]
    );

    res.status(201).json({ mensaje: 'Te has unido al grupo', idGrupo: invitacion.idGrupo });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'El enlace de invitación no es válido o ha expirado' });
    }
    res.status(500).json({ error: error.message });
  }
};

const actualizarRolMiembro = async (req, res) => {
  const client = await pool.connect();

  try {
    const { idGrupo, idUsuario } = req.params;
    const { rol } = req.body;

    if (!['cuidador', 'paciente'].includes(rol)) {
      return res.status(400).json({ error: 'El rol debe ser cuidador o paciente' });
    }

    await client.query('BEGIN');
    const miembroRes = await client.query(
      'SELECT gu.id_usuario, (u.correo IS NULL) AS es_manual FROM grupo_usuario gu INNER JOIN usuario u ON u.id_usuario = gu.id_usuario WHERE gu.id_grupo = $1 AND gu.id_usuario = $2 FOR UPDATE OF gu',
      [idGrupo, idUsuario]
    );
    if (miembroRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El usuario no pertenece a este grupo' });
    }

    // Un paciente sin celular (sin correo) no puede pasar a cuidador.
    if (rol === 'cuidador' && miembroRes.rows[0].es_manual) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Un paciente sin celular no puede cambiar a cuidador' });
    }

    if (rol === 'paciente') {
      const pacienteRes = await client.query(
        `SELECT gu.id_usuario FROM grupo_usuario gu
         INNER JOIN paciente p ON p.id_usuario = gu.id_usuario
         WHERE gu.id_grupo = $1 AND gu.id_usuario <> $2
         FOR UPDATE`,
        [idGrupo, idUsuario]
      );
      if (pacienteRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Este grupo ya tiene un paciente' });
      }
    }

    await client.query('DELETE FROM cuidador WHERE id_usuario = $1', [idUsuario]);
    await client.query('DELETE FROM paciente WHERE id_usuario = $1', [idUsuario]);

    if (rol === 'paciente') {
      await client.query('INSERT INTO paciente (id_usuario) VALUES ($1)', [idUsuario]);
    } else {
      await client.query('INSERT INTO cuidador (id_usuario) VALUES ($1)', [idUsuario]);
    }

    const actualizado = await client.query(
      'UPDATE grupo_usuario SET rol = $1 WHERE id_grupo = $2 AND id_usuario = $3 RETURNING id_usuario, id_grupo, rol',
      [rol, idGrupo, idUsuario]
    );
    await client.query('COMMIT');
    res.status(200).json({ miembro: actualizado.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este grupo ya tiene un paciente' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const eliminarMiembroGrupo = async (req, res) => {
  const client = await pool.connect();
  try {
    const { idGrupo, idUsuario } = req.params;

    await client.query('BEGIN');

    const miembroRes = await client.query(
      'SELECT id_usuario FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2 FOR UPDATE',
      [idGrupo, idUsuario]
    );
    if (miembroRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El usuario no pertenece a este grupo' });
    }

    // Al salir del grupo, la clase del usuario vuelve a "cuidador" por defecto
    await client.query('DELETE FROM horario_cuidado WHERE id_cuidador = $1', [idUsuario]);
    await client.query('DELETE FROM paciente WHERE id_usuario = $1', [idUsuario]);
    await client.query('INSERT INTO cuidador (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING', [idUsuario]);

    await client.query('DELETE FROM grupo_usuario WHERE id_grupo = $1 AND id_usuario = $2', [idGrupo, idUsuario]);

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Miembro eliminado del grupo' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  crearGrupo,
  obtenerGrupoUsuario,
  obtenerMiembrosGrupo,
  crearPacienteManual,
  crearInvitacionGrupo,
  unirseAGrupo,
  actualizarRolMiembro,
  eliminarMiembroGrupo
};
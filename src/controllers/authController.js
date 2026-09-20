// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const codigosVerificacion = {}; 

const registrarUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const usuarioExistente = await pool.query('SELECT id_usuario FROM Usuario WHERE correo = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    codigosVerificacion[email] = { password: hashedPassword };

    res.status(200).json({ mensaje: 'Código generado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const verificarCodigo = async (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigosVerificacion[email]) {
      return res.status(400).json({ error: 'Sesión expirada o correo no encontrado.' });
    }

    if (codigo !== '1234') {
      return res.status(400).json({ error: 'Código inválido. Usa 1234' });
    }

    res.status(200).json({ mensaje: 'Código verificado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const completarPerfil = async (req, res) => {
  try {
    const { email, nombre, genero, fechaNacimiento } = req.body;
    const datosTemp = codigosVerificacion[email];

    if (!datosTemp) {
      return res.status(400).json({ error: 'Sesión de registro expirada.' });
    }
    if (!nombre || !genero || !fechaNacimiento) {
      return res.status(400).json({ error: 'Todos los campos del perfil son obligatorios' });
    }

    const nuevoUsuario = await pool.query(
      'INSERT INTO Usuario (nombre_usuario, password_usuario, fecha_nacimiento_usuario, genero, correo) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario',
      [nombre.trim(), datosTemp.password, fechaNacimiento, genero, email]
    );

    const idUsuario = nuevoUsuario.rows[0].id_usuario;
    delete codigosVerificacion[email];

    const token = jwt.sign({ id: idUsuario, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente', token, tieneGrupo: false, idUsuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    const resultado = await pool.query('SELECT * FROM Usuario WHERE correo = $1', [email]);
    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const usuario = resultado.rows[0];
    const passwordValido = await bcrypt.compare(password, usuario.password_usuario);
    if (!passwordValido) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const grupoRes = await pool.query('SELECT id_grupo FROM Grupo_Usuario WHERE id_usuario = $1', [usuario.id_usuario]);
    const tieneGrupo = grupoRes.rows.length > 0;

    const token = jwt.sign({ id: usuario.id_usuario, email: usuario.correo }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ mensaje: 'Inicio de sesión exitoso', token, tieneGrupo, idUsuario: usuario.id_usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const socialLoginUsuario = async (req, res) => {
  try {
    const { email, nombre, genero, fechaNacimiento } = req.body;
    if (!email || !nombre) {
      return res.status(400).json({ error: 'Datos insuficientes del proveedor externo' });
    }

    let resultado = await pool.query('SELECT * FROM Usuario WHERE correo = $1', [email]);
    let usuario;

    if (resultado.rows.length === 0) {
      const passwordAleatoria = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(passwordAleatoria, 10);
      
      const nuevoUsuario = await pool.query(
        'INSERT INTO Usuario (nombre_usuario, password_usuario, fecha_nacimiento_usuario, genero, correo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [nombre, hashedPassword, fechaNacimiento || '2000-01-01', genero || 'Otro', email]
      );
      usuario = nuevoUsuario.rows[0];
    } else {
      usuario = resultado.rows[0];
    }

    const grupoRes = await pool.query('SELECT id_grupo FROM Grupo_Usuario WHERE id_usuario = $1', [usuario.id_usuario]);
    const tieneGrupo = grupoRes.rows.length > 0;

    const token = jwt.sign({ id: usuario.id_usuario, email: usuario.correo }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ mensaje: 'Autenticación social exitosa', token, tieneGrupo, idUsuario: usuario.id_usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerPerfilUsuario = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id_usuario, nombre_usuario, correo, genero, fecha_nacimiento_usuario FROM Usuario WHERE id_usuario = $1',
      [req.params.idUsuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({ usuario: resultado.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarPerfilUsuario = async (req, res) => {
  try {
    const { nombre, genero, fechaNacimiento } = req.body;
    if (!nombre?.trim() || !genero || !fechaNacimiento) {
      return res.status(400).json({ error: 'Nombre, género y fecha de nacimiento son obligatorios' });
    }

    const resultado = await pool.query(
      `UPDATE Usuario
       SET nombre_usuario = $1, genero = $2, fecha_nacimiento_usuario = $3
       WHERE id_usuario = $4
       RETURNING id_usuario, nombre_usuario, correo, genero, fecha_nacimiento_usuario`,
      [nombre.trim(), genero, fechaNacimiento, req.params.idUsuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({ usuario: resultado.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  registrarUsuario,
  verificarCodigo,
  completarPerfil,
  loginUsuario,
  socialLoginUsuario,
  obtenerPerfilUsuario,
  actualizarPerfilUsuario
};
// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const OTP_MAX_ATTEMPTS = 5;
const OTP_SECRET = () => process.env.OTP_SECRET || process.env.JWT_SECRET;

const normalizarEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const emailValido = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashCodigo = (email, codigo) => {
  const secret = OTP_SECRET();
  if (!secret) {
    const error = new Error('Falta configurar OTP_SECRET o JWT_SECRET');
    error.statusCode = 503;
    throw error;
  }
  return crypto.createHmac('sha256', secret).update(`${email}:${codigo}`).digest('hex');
};

const enviarCodigoPorCorreo = async (email, codigo) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !Number.isInteger(port) || !user || !pass || !from) {
    const error = new Error('La configuración SMTP está incompleta');
    error.statusCode = 503;
    throw error;
  }

  const secure = process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE.toLowerCase() === 'true';
  const transportador = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    await transportador.sendMail({
      from,
      to: email,
      subject: 'Código de verificación de Maru',
      text: `Tu código de verificación es ${codigo}. Caduca en 10 minutos.`,
      html: `<p>Tu código de verificación de Maru es:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 6px">${codigo}</p><p>Caduca en 10 minutos.</p>`
    });
  } finally {
    transportador.close?.();
  }
};

const emitirCodigoVerificacion = async (email, passwordHash = null) => {
  const codigo = crypto.randomInt(100000, 1000000).toString();
  const codigoHash = hashCodigo(email, codigo);
  
  // Incluye la cláusula WHERE para respetar el intervalo de 60 segundos en reenvíos
  const guardado = await pool.query(
    `INSERT INTO verificacion_correo (correo, codigo_hash, password_hash, expira_en, intentos, verificado_en, ultimo_envio)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes', 0, NULL, NOW())
     ON CONFLICT (correo) DO UPDATE SET
       codigo_hash = EXCLUDED.codigo_hash,
       password_hash = COALESCE(EXCLUDED.password_hash, verificacion_correo.password_hash),
       expira_en = EXCLUDED.expira_en,
       intentos = 0,
       verificado_en = NULL,
       ultimo_envio = NOW()
     WHERE verificacion_correo.ultimo_envio <= NOW() - INTERVAL '60 seconds'
     RETURNING correo`,
    [email, codigoHash, passwordHash]
  );

  if (guardado.rows.length === 0) {
    const error = new Error('Espera un minuto antes de solicitar otro código');
    error.statusCode = 429;
    throw error;
  }

  try {
    await enviarCodigoPorCorreo(email, codigo);
  } catch (error) {
    await pool.query(
      `UPDATE verificacion_correo
       SET codigo_hash = NULL, intentos = 0, expira_en = NOW()
       WHERE correo = $1 AND codigo_hash = $2`,
      [email, codigoHash]
    );
    error.statusCode ||= 503;
    throw error;
  }
};

const responderErrorCodigo = (res, error) => {
  console.error('Error en la verificación de correo:', error.message);
  const statusCode = error.statusCode || 500;
  const mensaje = statusCode === 429
    ? error.message
    : statusCode === 503
      ? 'No se pudo enviar el código. Intenta más tarde o revisa el servicio de correo.'
      : 'No se pudo procesar la solicitud de verificación';
  return res.status(statusCode).json({ error: mensaje });
};

const solicitarCodigo = async (req, res) => {
  try {
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;

    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Introduce un correo electrónico válido' });
    }

    const usuarioExistente = await pool.query('SELECT id_usuario FROM Usuario WHERE LOWER(correo) = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya está registrado' });
    }

    let passwordHash = null;
    if (typeof password === 'string' && password.trim() !== '') {
      passwordHash = await bcrypt.hash(password, 10);
    } else {
      // Si la petición viene de un reenvío sin contraseña, rescatamos la existente para no perderla
      const tempAntiguo = await pool.query('SELECT password_hash FROM verificacion_correo WHERE LOWER(correo) = $1', [email]);
      if (tempAntiguo.rows.length > 0 && tempAntiguo.rows[0].password_hash) {
        passwordHash = tempAntiguo.rows[0].password_hash;
      }
    }

    await emitirCodigoVerificacion(email, passwordHash);
    return res.status(200).json({ mensaje: 'Código de verificación enviado con éxito' });
  } catch (error) {
    return responderErrorCodigo(res, error);
  }
};

const registrarUsuario = solicitarCodigo;

const verificarCodigo = async (req, res) => {
  try {
    const email = normalizarEmail(req.body?.email);
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';

    if (!emailValido(email) || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ error: 'Correo o código inválido' });
    }

    const resultado = await pool.query(
      'SELECT codigo_hash, expira_en, intentos, verificado_en FROM verificacion_correo WHERE LOWER(correo) = $1',
      [email]
    );
    const registro = resultado.rows[0];

    if (!registro) {
      return res.status(400).json({ error: 'Sesión expirada o correo no encontrado.' });
    }

    if (registro.verificado_en) {
      return res.status(200).json({ mensaje: 'Código verificado correctamente' });
    }

    const codigoHash = hashCodigo(email, codigo);
    if (registro.codigo_hash !== codigoHash) {
      return res.status(400).json({ error: 'Código incorrecto.' });
    }

    // Al verificar, borramos el código hash y marcamos verificado, manteniendo intacto el password_hash
    await pool.query(
      `UPDATE verificacion_correo
       SET codigo_hash = NULL, verificado_en = NOW(), expira_en = NOW() + INTERVAL '1 hour'
       WHERE LOWER(correo) = $1`,
      [email]
    );

    return res.status(200).json({ mensaje: 'Código verificado correctamente' });
  } catch (error) {
    console.error('Error en verificarCodigo:', error.message);
    return res.status(500).json({ error: 'No se pudo verificar el código' });
  }
};

const completarPerfil = async (req, res) => {
  const emailLimpio = normalizarEmail(req.body?.email);
  const { nombre, genero, fechaNacimiento } = req.body || {};

  if (!emailValido(emailLimpio) || !nombre?.trim() || !['Masculino', 'Femenino', 'Otro'].includes(genero) || !fechaNacimiento) {
    return res.status(400).json({ error: 'Todos los campos del perfil son obligatorios' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const datosTempResult = await client.query(
      `SELECT password_hash FROM verificacion_correo WHERE LOWER(correo) = $1 FOR UPDATE`,
      [emailLimpio]
    );
    const datosTemp = datosTempResult.rows[0];

    if (!datosTemp || !datosTemp.password_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sesión de registro expirada.' });
    }

    const nuevoUsuario = await client.query(
      'INSERT INTO Usuario (nombre_usuario, password_usuario, fecha_nacimiento_usuario, genero, correo) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario',
      [nombre.trim(), datosTemp.password_hash, fechaNacimiento, genero, emailLimpio]
    );

    const idUsuario = nuevoUsuario.rows[0].id_usuario;
    const token = jwt.sign({ id: idUsuario, email: emailLimpio }, process.env.JWT_SECRET, { expiresIn: '7d' });

    await client.query('DELETE FROM verificacion_correo WHERE LOWER(correo) = $1', [emailLimpio]);
    await client.query('COMMIT');

    return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', token, tieneGrupo: false, idUsuario });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'El usuario ya está registrado' });
    console.error('Error al completar el perfil:', error.message);
    return res.status(500).json({ error: 'No se pudo completar el registro' });
  } finally {
    client?.release();
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    const resultado = await pool.query('SELECT * FROM Usuario WHERE LOWER(correo) = $1', [email.trim().toLowerCase()]);
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
    const { provider, accessToken, identityToken, nombre, genero, fechaNacimiento } = req.body;
    let perfil;

    if (provider === 'google' && accessToken) {
      const respuestaGoogle = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (respuestaGoogle.ok) {
        const datosGoogle = await respuestaGoogle.json();
        if (datosGoogle.sub && datosGoogle.email && (datosGoogle.email_verified === true || datosGoogle.email_verified === 'true')) {
          perfil = { email: datosGoogle.email.toLowerCase(), nombre: datosGoogle.name || datosGoogle.email.split('@')[0] };
        }
      }
    }

    if (!perfil) {
      return res.status(401).json({ error: 'No se pudo verificar la identidad con el proveedor externo' });
    }

    let resultado = await pool.query('SELECT * FROM Usuario WHERE LOWER(correo) = $1', [perfil.email]);
    let usuario;

    if (resultado?.rows.length > 0) {
      usuario = resultado.rows[0];
    } else {
      const passwordAleatoria = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(passwordAleatoria, 10);

      const nuevoUsuario = await pool.query(
        `INSERT INTO Usuario (nombre_usuario, password_usuario, fecha_nacimiento_usuario, genero, correo)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [perfil.nombre || perfil.email.split('@')[0], hashedPassword, fechaNacimiento || '2000-01-01', genero || 'Otro', perfil.email]
      );
      usuario = nuevoUsuario.rows[0];
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
      `UPDATE Usuario SET nombre_usuario = $1, genero = $2, fecha_nacimiento_usuario = $3 WHERE id_usuario = $4 RETURNING id_usuario, nombre_usuario, correo, genero, fecha_nacimiento_usuario`,
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

const eliminarCuentaUsuario = async (req, res) => {
  const { idUsuario } = req.params;
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'La contraseña es obligatoria para eliminar la cuenta' });
  }

  try {
    const usuarioRes = await pool.query('SELECT password_usuario FROM Usuario WHERE id_usuario = $1', [idUsuario]);
    if (usuarioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const passwordValido = await bcrypt.compare(password, usuarioRes.rows[0].password_usuario);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM notificacion WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM horario_cuidado WHERE id_cuidador = $1', [idUsuario]);
      await client.query('DELETE FROM sintoma WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM chat_mensaje WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM paciente WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM cuidador WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM grupo_usuario WHERE id_usuario = $1', [idUsuario]);
      await client.query('DELETE FROM Usuario WHERE id_usuario = $1', [idUsuario]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    res.status(200).json({ mensaje: 'Cuenta eliminada permanentemente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  solicitarCodigo,
  registrarUsuario,
  verificarCodigo,
  completarPerfil,
  loginUsuario,
  socialLoginUsuario,
  obtenerPerfilUsuario,
  actualizarPerfilUsuario,
  eliminarCuentaUsuario
};
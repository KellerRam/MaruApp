const pool = require('../src/config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { solicitarCodigo, registrarUsuario, verificarCodigo, completarPerfil, loginUsuario, socialLoginUsuario } = require('../src/controllers/authController');
const fetchOriginal = global.fetch;

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  decode: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const crearRespuesta = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('loginUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchOriginal;
    process.env.JWT_SECRET = 'test-secret';
    process.env.OTP_SECRET = 'otp-test-secret';
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'mailer@test.local';
    process.env.SMTP_PASS = 'test-password';
    process.env.SMTP_FROM = 'Maru <mailer@test.local>';
    nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message' }) });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('rechaza la petición cuando faltan correo o contraseña', async () => {
    const respuesta = crearRespuesta();

    await loginUsuario({ body: { email: '', password: '' } }, respuesta);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Correo y contraseña requeridos' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rechaza un usuario que no existe', async () => {
    const respuesta = crearRespuesta();
    pool.query.mockResolvedValueOnce({ rows: [] });

    await loginUsuario({ body: { email: 'no@existe.com', password: 'secreto' } }, respuesta);

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM Usuario WHERE correo = $1',
      ['no@existe.com']
    );
    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  it('rechaza una contraseña incorrecta', async () => {
    const respuesta = crearRespuesta();
    pool.query.mockResolvedValueOnce({
      rows: [{ id_usuario: 7, correo: 'usuario@test.com', password_usuario: 'hash' }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    await loginUsuario({ body: { email: 'usuario@test.com', password: 'incorrecta' } }, respuesta);

    expect(bcrypt.compare).toHaveBeenCalledWith('incorrecta', 'hash');
    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it.each([
    [true, [{ id_grupo: 3 }]],
    [false, []],
  ])('inicia sesión correctamente y devuelve tieneGrupo=%s', async (tieneGrupo, grupos) => {
    const respuesta = crearRespuesta();
    const usuario = {
      id_usuario: 7,
      correo: 'usuario@test.com',
      password_usuario: 'hash',
    };
    pool.query
      .mockResolvedValueOnce({ rows: [usuario] })
      .mockResolvedValueOnce({ rows: grupos });
    bcrypt.compare.mockResolvedValueOnce(true);
    jwt.sign.mockReturnValueOnce('token-de-prueba');

    await loginUsuario({ body: { email: usuario.correo, password: 'correcta' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'SELECT id_grupo FROM Grupo_Usuario WHERE id_usuario = $1',
      [usuario.id_usuario]
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: usuario.id_usuario, email: usuario.correo },
      'test-secret',
      { expiresIn: '7d' }
    );
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({
      mensaje: 'Inicio de sesión exitoso',
      token: 'token-de-prueba',
      tieneGrupo,
      idUsuario: usuario.id_usuario,
    });
  });

  it('devuelve 500 cuando falla la base de datos', async () => {
    const respuesta = crearRespuesta();
    pool.query.mockRejectedValueOnce(new Error('Base de datos no disponible'));

    await loginUsuario({ body: { email: 'usuario@test.com', password: 'secreto' } }, respuesta);

    expect(respuesta.status).toHaveBeenCalledWith(500);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Base de datos no disponible' });
  });

  it('envía un código de seis dígitos al solicitar el registro', async () => {
    const respuesta = crearRespuesta();
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'test-message' });
    nodemailer.createTransport.mockReturnValueOnce({ sendMail });
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ correo: 'persona@test.com' }] });
    bcrypt.hash.mockResolvedValueOnce('password-hash');
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(123456);

    await registrarUsuario({ body: { email: ' Persona@Test.com ', password: 'secreto' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id_usuario FROM Usuario WHERE LOWER(correo) = $1',
      ['persona@test.com']
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'persona@test.com',
      text: expect.stringContaining('123456'),
    }));
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({ mensaje: 'Código de verificación enviado con éxito' });
  });

  it('conserva el registro pendiente y devuelve 503 si falla el SMTP', async () => {
    const respuesta = crearRespuesta();
    nodemailer.createTransport.mockReturnValueOnce({ sendMail: jest.fn().mockRejectedValue(new Error('SMTP caído')) });
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ correo: 'persona@test.com' }] })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.hash.mockResolvedValueOnce('password-hash');
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(123456);

    await registrarUsuario({ body: { email: 'persona@test.com', password: 'secreto' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('SET codigo_hash = NULL'),
      ['persona@test.com', expect.any(String)]
    );
    expect(respuesta.status).toHaveBeenCalledWith(503);
    expect(respuesta.json).toHaveBeenCalledWith({
      error: 'No se pudo enviar el código. Intenta más tarde o revisa el servicio de correo.',
    });
  });

  it('permite reenviar un código para un registro pendiente', async () => {
    const respuesta = crearRespuesta();
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'test-message' });
    nodemailer.createTransport.mockReturnValueOnce({ sendMail });
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ password_hash: 'password-hash', verificado_en: null }] })
      .mockResolvedValueOnce({ rows: [{ correo: 'persona@test.com' }] });
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(654321);

    await solicitarCodigo({ body: { email: 'persona@test.com' } }, respuesta);

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'persona@test.com',
      text: expect.stringContaining('654321'),
    }));
    expect(respuesta.status).toHaveBeenCalledWith(200);
  });

  it('verifica el código recibido y lo invalida para nuevos usos', async () => {
    const respuesta = crearRespuesta();
    const email = 'persona@test.com';
    const codigo = '482917';
    const codigoHash = crypto.createHmac('sha256', process.env.OTP_SECRET)
      .update(`${email}:${codigo}`)
      .digest('hex');
    pool.query
      .mockResolvedValueOnce({ rows: [{ codigo_hash: codigoHash, expira_en: new Date(Date.now() + 60000), intentos: 0, verificado_en: null }] })
      .mockResolvedValueOnce({ rows: [{ correo: email }] });

    await verificarCodigo({ body: { email, codigo } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SET codigo_hash = NULL'), [email, codigoHash]);
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({ mensaje: 'Código verificado correctamente' });
  });

  it('completa el perfil usando la contraseña persistida de la verificación', async () => {
    const respuesta = crearRespuesta();
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ password_hash: 'password-hash' }] })
      .mockResolvedValueOnce({ rows: [{ id_usuario: 31 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce();
    jwt.sign.mockReturnValueOnce('registro-token');

    await completarPerfil({
      body: {
        email: ' Persona@Test.com ',
        nombre: ' Persona ',
        genero: 'Otro',
        fechaNacimiento: '1990-05-12',
      },
    }, respuesta);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FOR UPDATE'), ['persona@test.com']);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO Usuario'),
      ['Persona', 'password-hash', '1990-05-12', 'Otro', 'persona@test.com']
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'DELETE FROM verificacion_correo WHERE correo = $1', ['persona@test.com']);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('rechaza el código incorrecto y cuenta el intento', async () => {
    const respuesta = crearRespuesta();
    pool.query
      .mockResolvedValueOnce({ rows: [{ codigo_hash: 'a'.repeat(64), expira_en: new Date(Date.now() + 60000), intentos: 0, verificado_en: null }] })
      .mockResolvedValueOnce({ rows: [{ intentos: 1 }] });

    await verificarCodigo({ body: { email: 'persona@test.com', codigo: '000000' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('intentos = intentos + 1'), ['persona@test.com']);
    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Código inválido.' });
  });

  it('bloquea el código después de cinco intentos y conserva el registro pendiente', async () => {
    const respuesta = crearRespuesta();
    pool.query
      .mockResolvedValueOnce({ rows: [{ codigo_hash: 'a'.repeat(64), expira_en: new Date(Date.now() + 60000), intentos: 4, verificado_en: null }] })
      .mockResolvedValueOnce({ rows: [{ intentos: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    await verificarCodigo({ body: { email: 'persona@test.com', codigo: '000000' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining('codigo_hash = NULL'), ['persona@test.com']);
    expect(respuesta.status).toHaveBeenCalledWith(429);
    expect(respuesta.json).toHaveBeenCalledWith({
      error: 'Superaste el número de intentos. Solicita un nuevo código.',
    });
  });

  it('invalida un código expirado sin borrar el registro que permite reenviarlo', async () => {
    const respuesta = crearRespuesta();
    pool.query
      .mockResolvedValueOnce({ rows: [{ codigo_hash: 'a'.repeat(64), expira_en: new Date(Date.now() - 1000), intentos: 0, verificado_en: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await verificarCodigo({ body: { email: 'persona@test.com', codigo: '000000' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('codigo_hash = NULL'), ['persona@test.com']);
    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'El código expiró. Solicita uno nuevo.' });
  });

  it('rechaza un token de Google que no identifica un correo verificado', async () => {
    const respuesta = crearRespuesta();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: 'google-id', email: 'persona@test.com' }),
    });

    await socialLoginUsuario({ body: { provider: 'google', accessToken: 'token-invalido' } }, respuesta);

    expect(pool.query).not.toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(401);
  });

  it('crea una sesión usando el perfil verificado por Google', async () => {
    const respuesta = crearRespuesta();
    const usuario = { id_usuario: 21, correo: 'persona@test.com' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: 'google-id', email: usuario.correo, email_verified: true, name: 'Persona' }),
    });
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [usuario] })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.hash.mockResolvedValueOnce('hash-social');
    jwt.sign.mockReturnValueOnce('token-de-prueba');

    await socialLoginUsuario({ body: { provider: 'google', accessToken: 'token-google' } }, respuesta);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM Usuario WHERE correo = $1',
      [usuario.correo]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO Usuario'),
      ['Persona', 'hash-social', '2000-01-01', 'Otro', usuario.correo, null]
    );
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({
      mensaje: 'Autenticación social exitosa',
      token: 'token-de-prueba',
      tieneGrupo: false,
      idUsuario: usuario.id_usuario,
    });
  });

  it('identifica una cuenta Apple existente aunque el proveedor ya no devuelva correo', async () => {
    const respuesta = crearRespuesta();
    const usuario = { id_usuario: 12, correo: 'relay@privaterelay.appleid.com', apple_user_id: 'apple-subject' };
    jwt.decode.mockReturnValueOnce({ header: { kid: 'apple-key', alg: 'RS256' } });
    jwt.verify.mockReturnValueOnce({ sub: 'apple-subject' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'apple-key', kty: 'RSA' }] }),
    });
    jest.spyOn(crypto, 'createPublicKey').mockReturnValue({});
    pool.query
      .mockResolvedValueOnce({ rows: [usuario] })
      .mockResolvedValueOnce({ rows: [{ id_grupo: 3 }] });
    jwt.sign.mockReturnValueOnce('token-de-prueba');
    delete process.env.APPLE_CLIENT_ID;

    await socialLoginUsuario({ body: { provider: 'apple', identityToken: 'token-apple', nombre: 'Persona' } }, respuesta);

    expect(jwt.verify).toHaveBeenCalledWith('token-apple', {}, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: 'com.maruapp',
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM Usuario WHERE apple_user_id = $1',
      ['apple-subject']
    );
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({
      mensaje: 'Autenticación social exitosa',
      token: 'token-de-prueba',
      tieneGrupo: true,
      idUsuario: usuario.id_usuario,
    });
  });
});
const pool = require('../src/config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { loginUsuario } = require('../src/controllers/authController');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

const crearRespuesta = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('loginUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
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
});
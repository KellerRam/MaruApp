const request = require('supertest');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const app = require('../server');
const pool = require('../src/config/db');

describe('integración HTTP del servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('responde el estado del servidor con CORS habilitado', async () => {
    const respuesta = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:8081');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      status: 'ok',
      message: 'Servidor activo y conectado',
    });
    expect(respuesta.headers['access-control-allow-origin']).toBe('*');
  });

  it('recorre la ruta de horarios y valida el cuerpo de un medicamento', async () => {
    const respuesta = await request(app)
      .post('/api/schedules/medicamento')
      .set('Origin', 'http://localhost:8081')
      .send({ id_grupo: 8 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: 'Todos los campos obligatorios del medicamento deben estar completos',
    });
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(respuesta.headers['access-control-allow-origin']).toBe('*');
  });

  it('responde correctamente al preflight de creación de medicamentos', async () => {
    const respuesta = await request(app)
      .options('/api/schedules/medicamento')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(respuesta.status).toBe(204);
    expect(respuesta.headers['access-control-allow-origin']).toBe('*');
    expect(respuesta.headers['access-control-allow-methods']).toContain('POST');
  });
});
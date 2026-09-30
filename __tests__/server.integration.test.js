const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const app = require('../server');
const pool = require('../src/config/db');

describe('integración HTTP del servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    pool.connect.mockReset();
    process.env.JWT_SECRET = 'integration-test-secret';
  });

  const tokenDeSesion = (id = 3) => jwt.sign({ id, email: `usuario${id}@test.com` }, process.env.JWT_SECRET);

  it('responde el estado del servidor con CORS habilitado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const respuesta = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:8081');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      status: 'ok',
      message: 'Servidor activo y conectado',
    });
    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reporta indisponibilidad cuando PostgreSQL falla en el health check', async () => {
    pool.query.mockRejectedValueOnce(new Error('database unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const respuesta = await request(app).get('/api/health');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body).toEqual({ status: 'error', message: 'Base de datos no disponible' });
  });

  it('rechaza solicitudes sin sesión en rutas privadas', async () => {
    const respuesta = await request(app).get('/api/groups/user/3');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ error: 'Debes iniciar sesión para continuar' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('permite a pacientes consultar los mensajes de cuidadores del grupo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        id_mensaje: 22,
        id_usuario: 4,
        tipo: 'texto',
        texto: 'Aviso para el grupo',
        archivo_url: null,
        remitente: 'Cuidador',
        es_mio: false,
      }] });

    const respuesta = await request(app)
      .get('/api/chat/group/8/messages')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`);

    expect(respuesta.body).toEqual({
      mensajes: [expect.objectContaining({ texto: 'Aviso para el grupo' })],
    });
    expect(pool.query.mock.calls[2][0]).not.toContain('solo_cuidadores');
  });

  it('impide consultar el grupo de otro usuario aunque la sesión sea válida', async () => {
    const respuesta = await request(app)
      .get('/api/groups/user/8')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: 'No tienes permiso para acceder a este usuario' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('usa el ID de la sesión al crear un mensaje aunque el cuerpo indique otro usuario', async () => {
    const mensaje = { id_mensaje: 21, id_grupo: 8, id_usuario: 3, tipo: 'texto', texto: 'Hola' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [mensaje] })
      .mockResolvedValueOnce({ rows: [{ nombre_usuario: 'Usuario 3' }] })
      .mockResolvedValueOnce({ rows: [] });

    const respuesta = await request(app)
      .post('/api/chat/group/8/messages')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .send({ idUsuario: 99, tipo: 'texto', texto: 'Hola' });

    expect(respuesta.status).toBe(201);
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO chat_mensaje'),
      ['8', 3, 'texto', 'Hola', null, null, null]
    );
    expect(pool.query.mock.calls[2][0]).not.toContain('solo_cuidadores');
    expect(respuesta.body.mensaje.id_usuario).toBe(3);
  });

  it('rechaza contenido HTML ejecutable en adjuntos con una respuesta controlada', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ existe: 1 }] });

    const respuesta = await request(app)
      .post('/api/chat/group/8/messages')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .field('tipo', 'documento')
      .attach('archivo', Buffer.from('<script>alert(1)</script>'), { filename: 'archivo.html', contentType: 'text/html' });

    expect(respuesta.status).toBe(415);
    expect(respuesta.body).toEqual({ error: 'Tipo de archivo no permitido' });
  });

  it('permite enviar documentos de texto como adjuntos del grupo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        id_mensaje: 23,
        id_grupo: 8,
        id_usuario: 3,
        tipo: 'documento',
        archivo_url: '/uploads/chat/archivo.txt',
      }] })
      .mockResolvedValueOnce({ rows: [{ nombre_usuario: 'Usuario 3' }] })
      .mockResolvedValueOnce({ rows: [] });

    const respuesta = await request(app)
      .post('/api/chat/group/8/messages')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .field('tipo', 'documento')
      .attach('archivo', Buffer.from('contenido del documento'), { filename: 'archivo.txt', contentType: 'text/plain' });

    expect(respuesta.status).toBe(201);
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO chat_mensaje'),
      ['8', 3, 'documento', '', expect.stringMatching(/^\/uploads\/chat\/[0-9a-f-]+\.txt$/), 'archivo.txt', 'text/plain']
    );
  });

  it('no publica rutas crudas de uploads y valida URLs firmadas de medios', async () => {
    const rutaPublica = await request(app).get('/uploads/chat/archivo-privado.m4a');
    const token = jwt.sign({ alcance: 'archivo', ruta: 'chat/archivo-inexistente.m4a' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const rutaFirmada = await request(app).get(`/api/media/${token}`);

    expect(rutaPublica.status).toBe(404);
    expect(rutaFirmada.status).toBe(404);
    expect(rutaFirmada.body).toEqual({ error: 'No se pudo obtener el archivo' });
  });

  it('expone el endpoint de reenvío de código y valida el correo', async () => {
    const respuesta = await request(app)
      .post('/api/auth/request-code')
      .send({ email: 'correo-invalido' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: 'Introduce un correo electrónico válido' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it.each(['gasto', 'ingreso'])('permite eliminar un movimiento tipo %s', async (tipo) => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
      .mockResolvedValueOnce({ rows: [{ comprobante: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const respuesta = await request(app)
      .delete(`/api/finances/${tipo}/9`)
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .send({ id_usuario: 3 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ mensaje: 'Registro eliminado correctamente' });
  });

  it('actualiza movimientos solo dentro de un grupo propio y confirma la transacción', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ comprobante: null }] })
        .mockResolvedValueOnce({ rows: [{ id: 9, fecha: '2026-09-20', hora: '12:00:00', cantidad: '50', comprobante: null, descripcion: 'Ajuste', id_presupuesto: 4 }] })
        .mockResolvedValueOnce(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(client);

    const respuesta = await request(app)
      .put('/api/finances/gasto/9')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .field('fecha', '2026-09-20')
      .field('hora', '12:00')
      .field('cantidad', '50')
      .field('descripcion', 'Ajuste')
      .field('id_grupo', '8');

    expect(respuesta.status).toBe(200);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining('gu.id_usuario = $7'), [
      '2026-09-20', '12:00:00', 50, null, 'Ajuste', '9', 3,
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('agrega un paciente manual sin correo y lo asigna como paciente del grupo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] });
    const cliente = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [{ rol: 'cuidador' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id_usuario: 24 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(cliente);

    const respuesta = await request(app)
      .post('/api/groups/8/patients/manual')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .send({
        idUsuario: 3,
        nombre: '  Paciente Manual  ',
        genero: 'Otro',
        fechaNacimiento: '1940-01-02',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.miembro).toEqual({ id_usuario: 24, nombre: 'Paciente Manual', rol: 'paciente' });
    expect(cliente.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('VALUES ($1, $2, $3, $4, NULL)'),
      ['Paciente Manual', expect.any(String), '1940-01-02', 'Otro']
    );
    expect(cliente.query).toHaveBeenNthCalledWith(
      7,
      "INSERT INTO grupo_usuario (id_usuario, id_grupo, rol) VALUES ($1, $2, 'paciente')",
      [24, '8']
    );
    expect(cliente.query).toHaveBeenLastCalledWith('COMMIT');
    expect(cliente.release).toHaveBeenCalled();
  });

  it('crea el calendario faltante bajo bloqueo del grupo dentro de una transacción', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] });
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id_calendario: 5, id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(client);

    const respuesta = await request(app)
      .get('/api/calendar/group/8')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id_calendario: 5, id_grupo: 8, eventos: [] });
    expect(client.query).toHaveBeenNthCalledWith(2, 'SELECT id_grupo FROM grupo WHERE id_grupo = $1 FOR UPDATE', ['8']);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rechaza fechas imposibles al crear eventos antes de consultar PostgreSQL', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
      .mockResolvedValueOnce({ rows: [{ existe: 1 }] });

    const respuesta = await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .send({
        nombre_evento: 'Evento',
        fecha_evento: '2026-02-31',
        hora_evento: '12:00',
        id_calendario: 5,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: 'Nombre, fecha válida, hora e id_calendario son obligatorios' });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('recorre la ruta de horarios y valida el cuerpo de un medicamento', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] });
    const respuesta = await request(app)
      .post('/api/schedules/medicamento')
      .set('Origin', 'http://localhost:8081')
      .set('Authorization', `Bearer ${tokenDeSesion(3)}`)
      .send({ id_grupo: 8 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: 'Todos los campos obligatorios del medicamento deben estar completos',
    });
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });

  it('responde correctamente al preflight de creación de medicamentos', async () => {
    const respuesta = await request(app)
      .options('/api/schedules/medicamento')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(respuesta.status).toBe(204);
    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(respuesta.headers['access-control-allow-methods']).toContain('POST');
  });
});
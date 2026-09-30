const pool = require('../src/config/db');
const {
  obtenerHorariosYEventos,
  crearHorarioMedicamento,
  crearHorarioCuidado,
  actualizarHorarioMedicamento,
  actualizarHorarioCuidado,
  eliminarHorarioMedicamento,
  eliminarHorarioCuidado,
} = require('../src/controllers/scheduleController');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const crearRespuesta = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const crearCliente = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

describe('controlador de horarios', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('obtenerHorariosYEventos', () => {
    it('rechaza la consulta cuando falta el grupo', async () => {
      const respuesta = crearRespuesta();

      await obtenerHorariosYEventos({ params: {} }, respuesta);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(respuesta.json).toHaveBeenCalledWith({ error: 'El ID de grupo es obligatorio' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('devuelve turnos, eventos y medicamentos del grupo', async () => {
      const respuesta = crearRespuesta();
      const horariosCuidado = [{ id_horario_cuidado: 1 }];
      const eventosProximos = [{ id_evento: 2 }];
      const medicamentos = [{ id_horario_medicamento: 3 }];
      pool.query
        .mockResolvedValueOnce({ rows: horariosCuidado })
        .mockResolvedValueOnce({ rows: eventosProximos })
        .mockResolvedValueOnce({ rows: medicamentos });

      await obtenerHorariosYEventos({ params: { idGrupo: '8' } }, respuesta);

      expect(pool.query).toHaveBeenCalledTimes(3);
      expect(respuesta.status).toHaveBeenCalledWith(200);
      expect(respuesta.json).toHaveBeenCalledWith({
        horariosCuidado,
        medicamentos,
        eventosProximos,
      });
    });
  });

  describe('crearHorarioMedicamento', () => {
    it('rechaza campos obligatorios incompletos', async () => {
      const respuesta = crearRespuesta();
      const cliente = crearCliente();
      pool.connect.mockResolvedValueOnce(cliente);

      await crearHorarioMedicamento({ body: { id_grupo: 8 } }, respuesta);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(respuesta.json).toHaveBeenCalledWith({
        error: 'Todos los campos obligatorios del medicamento deben estar completos',
      });
      expect(cliente.release).toHaveBeenCalled();
      expect(cliente.query).not.toHaveBeenCalled();
    });

    it('crea el medicamento y su toma dentro de una transacción', async () => {
      const respuesta = crearRespuesta();
      const cliente = crearCliente();
      const toma = { id_horario_medicamento: 3, hora_toma: '08:00:00' };
      pool.connect.mockResolvedValueOnce(cliente);
      cliente.query
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ id_medicamento: 12 }] })
        .mockResolvedValueOnce({ rows: [toma] })
        .mockResolvedValueOnce();

      await crearHorarioMedicamento({
        body: {
          id_grupo: 8,
          fecha_inicio: '2026-09-07',
          nombre_medicamento: '  Paracetamol ',
          dosis: ' 500 mg ',
          presentacion: ' Tableta ',
          frecuencia: ' Cada 8 horas ',
          hora_toma: '08:00',
        },
      }, respuesta);

      expect(cliente.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(cliente.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO medicamento'),
        ['Paracetamol', '500 mg', 'Tableta', 8]
      );
      expect(cliente.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO horario_medicamento'),
        [12, 'Cada 8 horas', '08:00:00', '2026-09-07']
      );
      expect(cliente.query).toHaveBeenNthCalledWith(4, 'COMMIT');
      expect(cliente.release).toHaveBeenCalled();
      expect(respuesta.status).toHaveBeenCalledWith(201);
      expect(respuesta.json).toHaveBeenCalledWith({
        mensaje: 'Tomas creadas exitosamente',
        toma: {
          ...toma,
          nombre_medicamento: 'Paracetamol',
          dosis: '500 mg',
          presentacion: 'Tableta',
          frecuencia: 'Cada 8 horas',
          fecha_inicio: '2026-09-07',
        },
      });
    });

    it('hace rollback cuando falla la creación', async () => {
      const respuesta = crearRespuesta();
      const cliente = crearCliente();
      pool.connect.mockResolvedValueOnce(cliente);
      cliente.query
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Error de inserción'))
        .mockResolvedValueOnce();

      await crearHorarioMedicamento({
        body: {
          id_grupo: 8,
          fecha_inicio: '2026-09-07',
          nombre_medicamento: 'Paracetamol',
          dosis: '500 mg',
          presentacion: 'Tableta',
          hora_toma: '08:00',
        },
      }, respuesta);

      expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
      expect(cliente.release).toHaveBeenCalled();
      expect(respuesta.status).toHaveBeenCalledWith(500);
      expect(respuesta.json).toHaveBeenCalledWith({ error: 'Error de inserción' });
    });
  });

  describe('crearHorarioCuidado', () => {
    it('rechaza un cuidador que no pertenece al grupo', async () => {
      const respuesta = crearRespuesta();
      const client = crearCliente();
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce();

      await crearHorarioCuidado({
        body: {
          id_grupo: 8,
          id_cuidador: 4,
          fecha_inicio: '2026-09-07',
          fecha_fin: '2026-09-07',
          hora_inicio: '08:00',
          hora_fin: '16:00',
        },
      }, respuesta);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(respuesta.json).toHaveBeenCalledWith({
        error: 'El cuidador seleccionado no existe en este grupo',
      });
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });

    it('crea un turno con horas normalizadas', async () => {
      const respuesta = crearRespuesta();
      const client = crearCliente();
      const horario = { id_horario_cuidado: 5, encargado: 'Ana' };
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [{ nombre_usuario: 'Ana' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [horario] })
        .mockResolvedValueOnce();

      await crearHorarioCuidado({
        body: {
          id_grupo: 8,
          id_cuidador: 4,
          fecha_inicio: '2026-09-07',
          fecha_fin: '2026-09-07',
          hora_inicio: '08:00',
          hora_fin: '16:00',
        },
      }, respuesta);

      expect(client.query).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining('INSERT INTO horario_cuidado'),
        [4, 'Ana', '08:00:00', '16:00:00', '2026-09-07', '2026-09-07']
      );
      expect(client.query).toHaveBeenLastCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalled();
      expect(respuesta.status).toHaveBeenCalledWith(201);
      expect(respuesta.json).toHaveBeenCalledWith({
        mensaje: 'Turno creado exitosamente',
        horario: {
          ...horario,
          fecha_inicio: '2026-09-07',
          fecha_fin: '2026-09-07',
        },
      });
    });

    it('rechaza un turno que se traslapa con otro del grupo', async () => {
      const respuesta = crearRespuesta();
      const client = crearCliente();
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
        .mockResolvedValueOnce({ rows: [{ nombre_usuario: 'Ana' }] })
        .mockResolvedValueOnce({ rows: [{ id_horario_cuidado: 9, encargado: 'Luis' }] })
        .mockResolvedValueOnce();

      await crearHorarioCuidado({
        body: {
          id_grupo: 8,
          id_cuidador: 4,
          fecha_inicio: '2026-09-07',
          fecha_fin: '2026-09-07',
          hora_inicio: '08:00',
          hora_fin: '16:00',
        },
      }, respuesta);

      expect(respuesta.status).toHaveBeenCalledWith(409);
      expect(respuesta.json).toHaveBeenCalledWith({
        error: 'Ya existe un turno de Luis que se traslapa con ese horario en el grupo',
      });
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });

  it('actualiza un medicamento existente', async () => {
    const respuesta = crearRespuesta();
    const client = crearCliente();
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ id_medicamento: 12 }] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();

    await actualizarHorarioMedicamento({
      params: { id: '3' },
      body: {
        nombre_medicamento: 'Nuevo nombre',
        dosis: '10 mg',
        presentacion: 'Jarabe',
        frecuencia: 'Cada 12 horas',
        hora_toma: '09:30',
        fecha_inicio: '2026-09-07',
      },
    }, respuesta);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE medicamento'),
      ['Nuevo nombre', '10 mg', 'Jarabe', 12]
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({ mensaje: 'Toma actualizada exitosamente' });
  });

  it('actualiza un turno dentro de una transacción y valida el grupo asignado', async () => {
    const respuesta = crearRespuesta();
    const client = crearCliente();
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ id_grupo: 8 }] })
      .mockResolvedValueOnce({ rows: [{ id_horario_cuidado: 6 }] })
      .mockResolvedValueOnce({ rows: [{ nombre_usuario: 'Ana' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ id_horario_cuidado: 6 }] })
      .mockResolvedValueOnce();

    await actualizarHorarioCuidado({
      params: { id: '6' },
      body: {
        id_grupo: 8,
        id_cuidador: 4,
        fecha_inicio: '2026-09-07',
        fecha_fin: '2026-09-07',
        hora_inicio: '08:00',
        hora_fin: '16:00',
      },
    }, respuesta);

    expect(client.query).toHaveBeenNthCalledWith(7, expect.stringContaining('UPDATE horario_cuidado'), [
      4, 'Ana', '08:00:00', '16:00:00', '2026-09-07', '2026-09-07', '6',
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(200);
  });

  it('elimina una toma pero conserva el medicamento si tiene otras repeticiones', async () => {
    const respuesta = crearRespuesta();
    const cliente = crearCliente();
    pool.connect.mockResolvedValueOnce(cliente);
    cliente.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ id_medicamento: 12 }] })
      .mockResolvedValueOnce({ rows: [{ id_horario_medicamento: 4 }] })
      .mockResolvedValueOnce();

    await eliminarHorarioMedicamento({ params: { id: '3' } }, respuesta);

    expect(cliente.query).toHaveBeenCalledWith(
      'SELECT 1 FROM horario_medicamento WHERE id_medicamento = $1 LIMIT 1',
      [12]
    );
    expect(cliente.query).not.toHaveBeenCalledWith('DELETE FROM medicamento WHERE id_medicamento = $1', [12]);
    expect(cliente.query).toHaveBeenLastCalledWith('COMMIT');
    expect(cliente.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith({ mensaje: 'Toma eliminada exitosamente' });
  });

  it('elimina el medicamento cuando se borra su última toma', async () => {
    const respuesta = crearRespuesta();
    const cliente = crearCliente();
    pool.connect.mockResolvedValueOnce(cliente);
    cliente.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({ rows: [{ id_medicamento: 12 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();

    await eliminarHorarioMedicamento({ params: { id: '3' } }, respuesta);

    expect(cliente.query).toHaveBeenNthCalledWith(4, 'DELETE FROM medicamento WHERE id_medicamento = $1', [12]);
    expect(cliente.query).toHaveBeenLastCalledWith('COMMIT');
    expect(cliente.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(200);
  });

  it('rechaza un número excesivo de repeticiones', async () => {
    const respuesta = crearRespuesta();
    const cliente = crearCliente();
    pool.connect.mockResolvedValueOnce(cliente);

    await crearHorarioMedicamento({
      body: {
        id_grupo: 8,
        fecha_inicio: '2026-09-30',
        nombre_medicamento: 'Paracetamol',
        dosis: '500 mg',
        presentacion: 'Tableta',
        hora_toma: '08:00',
        intervalo_horas: 1,
        repeticiones: 1000000,
      },
    }, respuesta);

    expect(cliente.query).not.toHaveBeenCalled();
    expect(cliente.release).toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({
      error: 'Las repeticiones deben ser de 1 a 365 y el intervalo de 1 a 168 horas',
    });
  });

  it('devuelve 404 al eliminar un turno inexistente', async () => {
    const respuesta = crearRespuesta();
    pool.query.mockResolvedValueOnce({ rows: [] });

    await eliminarHorarioCuidado({ params: { id: '99' } }, respuesta);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Turno no encontrado' });
  });
});
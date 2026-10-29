// Programador en segundo plano (servidor) para alertas de bienestar, medicamentos y eventos.
// Se ejecuta en el proceso Node cada minuto; las notificaciones push llegan al dispositivo
// del usuario incluso si la app está cerrada, ya que el sistema operativo las entrega.
const pool = require('../config/db');
const { enviarPushATokens } = require('./pushNotifications');

const INTERVALO_MS = 60 * 1000;
const HORARIOS_BIENESTAR = ['08:00', '12:00', '16:00', '19:00', '22:00'];
const MINUTOS_ESCALAMIENTO_BIENESTAR = 5;
const MINUTOS_REINTENTO_MEDICAMENTO = 10;
const MINUTOS_ANTICIPACION_MEDICAMENTO = 15;
const MINUTOS_VENTANA_MEDICAMENTO_MAX = 180; // deja de reintentar tras 3 horas de la toma
let cicloEnCurso = false;
let intervaloProgramador = null;

const fechaLocalISO = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const registrarOActualizarAlerta = async ({ tipo, idUsuario, clave, pushToken, titulo, cuerpo, data }) => {
  if (typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken')) {
    return { esNueva: true, sinToken: true };
  }

  const reservada = await pool.query(
    `INSERT INTO alerta_notificacion (tipo, id_usuario, clave_ocurrencia)
     VALUES ($1, $2, $3) ON CONFLICT (tipo, id_usuario, clave_ocurrencia) DO NOTHING
     RETURNING id_alerta`,
    [tipo, idUsuario, clave]
  );

  if (reservada.rows.length > 0) {
    const entrega = await enviarPushATokens([pushToken], { title: titulo, body: cuerpo, data });
    if (entrega.enviados === 0 && entrega.fallidos > 0) {
      await pool.query(
        'DELETE FROM alerta_notificacion WHERE tipo = $1 AND id_usuario = $2 AND clave_ocurrencia = $3',
        [tipo, idUsuario, clave]
      );
    }
    return { esNueva: true, entregaFallida: entrega.enviados === 0 && entrega.fallidos > 0 };
  }

  const existente = await pool.query(
    'SELECT id_alerta, primer_envio, ultimo_envio, leida FROM alerta_notificacion WHERE tipo = $1 AND id_usuario = $2 AND clave_ocurrencia = $3',
    [tipo, idUsuario, clave]
  );
  return existente.rows.length ? { esNueva: false, ...existente.rows[0] } : { esNueva: true };
};

const verificarAlertasBienestar = async () => {
  const pacientes = await pool.query(
    `SELECT p.id_usuario, p.bienestar_frecuencia, u.push_token, gu.id_grupo
     FROM paciente p
     INNER JOIN usuario u ON u.id_usuario = p.id_usuario
     INNER JOIN grupo_usuario gu ON gu.id_usuario = p.id_usuario
     WHERE p.confirmacion_bienestar = true`
  );

  const ahora = new Date();
  const hoyISO = fechaLocalISO(ahora);

  for (const paciente of pacientes.rows) {
    const frecuencia = Math.min(5, Math.max(1, paciente.bienestar_frecuencia || 1));
    const horariosDelDia = HORARIOS_BIENESTAR.slice(0, frecuencia);

    for (const horario of horariosDelDia) {
      const [hh, mm] = horario.split(':').map(Number);
      const horaSlot = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0);
      if (ahora < horaSlot) continue;

      const clave = `${hoyISO}-${horario}`;
      const estado = await registrarOActualizarAlerta({
        tipo: 'bienestar',
        idUsuario: paciente.id_usuario,
        clave,
        pushToken: paciente.push_token,
        titulo: 'Alerta de bienestar',
        cuerpo: '¿Cómo te sientes hoy? Confirma que estás bien.',
        data: { tipo: 'bienestar', clave_ocurrencia: clave },
      });

      if (estado.esNueva || estado.leida) continue;

      const minutosDesdePrimero = (ahora - new Date(estado.primer_envio)) / 60000;
      const minutosDesdeUltimo = (ahora - new Date(estado.ultimo_envio)) / 60000;
      if (minutosDesdePrimero >= MINUTOS_ESCALAMIENTO_BIENESTAR && minutosDesdeUltimo >= MINUTOS_ESCALAMIENTO_BIENESTAR) {
        const reclamo = await pool.query(
          `UPDATE alerta_notificacion
           SET ultimo_envio = CURRENT_TIMESTAMP, intentos = intentos + 1
           WHERE tipo = $1 AND id_usuario = $2 AND clave_ocurrencia = $3
             AND leida = false AND ultimo_envio <= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
           RETURNING id_alerta`,
          ['bienestar', paciente.id_usuario, clave]
        );
        if (reclamo.rows.length === 0) continue;

        const mensaje = `ALERTA DE BIENESTAR: el paciente no ha confirmado la alerta de las ${horario}.`;
        await pool.query(
          `INSERT INTO chat_mensaje (id_grupo, id_usuario, tipo, texto) VALUES ($1, $2, 'texto', $3)`,
          [paciente.id_grupo, paciente.id_usuario, mensaje]
        );

        const cuidadores = await pool.query(
          `SELECT u.push_token FROM grupo_usuario gu
           INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
           WHERE gu.id_grupo = $1 AND gu.id_usuario <> $2`,
          [paciente.id_grupo, paciente.id_usuario]
        );
        await enviarPushATokens(cuidadores.rows.map((c) => c.push_token), {
          title: '⚠️ Alerta de bienestar sin confirmar',
          body: mensaje,
          data: { tipo: 'bienestar_escalada', id_grupo: paciente.id_grupo },
        });

      }
    }
  }
};

const verificarRecordatoriosMedicamento = async () => {
  const ahora = new Date();
  const tomas = await pool.query(
    `SELECT hm.id_horario_medicamento, hm.hora_toma, TO_CHAR(hm.fecha_toma, 'YYYY-MM-DD') AS fecha_toma,
            m.nombre_medicamento, m.dosis, m.id_grupo
     FROM horario_medicamento hm
     INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento`
  );

  for (const toma of tomas.rows) {
    const [anio, mes, dia] = toma.fecha_toma.split('-').map(Number);
    const [hh, mm] = String(toma.hora_toma).slice(0, 5).split(':').map(Number);
    const horaToma = new Date(anio, mes - 1, dia, hh, mm, 0);
    const minutosParaLaToma = (horaToma - ahora) / 60000;
    const minutosDesdeLaToma = (ahora - horaToma) / 60000;

    if (minutosParaLaToma > MINUTOS_ANTICIPACION_MEDICAMENTO) continue;
    if (minutosDesdeLaToma > MINUTOS_VENTANA_MEDICAMENTO_MAX) continue;

    const pacienteRes = await pool.query(
      `SELECT u.id_usuario, u.push_token FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       LEFT JOIN paciente p ON p.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND (p.id_usuario IS NOT NULL OR LOWER(TRIM(gu.rol)) = 'paciente')
       LIMIT 1`,
      [toma.id_grupo]
    );
    if (pacienteRes.rows.length === 0) continue;
    const paciente = pacienteRes.rows[0];

    const clave = `hm-${toma.id_horario_medicamento}`;
    const estado = await registrarOActualizarAlerta({
      tipo: 'medicamento',
      idUsuario: paciente.id_usuario,
      clave,
      pushToken: paciente.push_token,
      titulo: 'Recordatorio de medicamento',
      cuerpo: `Es hora de tomar ${toma.nombre_medicamento} (${toma.dosis})`,
      data: { tipo: 'medicamento', clave_ocurrencia: clave },
    });

    if (estado.esNueva || estado.leida) continue;

    const minutosDesdeUltimo = (ahora - new Date(estado.ultimo_envio)) / 60000;
    if (minutosDesdeUltimo >= MINUTOS_REINTENTO_MEDICAMENTO) {
      const reclamo = await pool.query(
        `UPDATE alerta_notificacion
         SET ultimo_envio = CURRENT_TIMESTAMP, intentos = intentos + 1
         WHERE tipo = $1 AND id_usuario = $2 AND clave_ocurrencia = $3
           AND leida = false AND ultimo_envio <= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
         RETURNING id_alerta`,
        ['medicamento', paciente.id_usuario, clave]
      );
      if (reclamo.rows.length === 0) continue;

      await enviarPushATokens([paciente.push_token], {
        title: 'Recordatorio de medicamento',
        body: `Aún no confirmas: ${toma.nombre_medicamento} (${toma.dosis})`,
        data: { tipo: 'medicamento', clave_ocurrencia: clave },
      });
    }
  }
};

const verificarRecordatoriosEvento = async () => {
  const ahora = new Date();
  const eventos = await pool.query(
    `SELECT e.id_evento, e.nombre_evento, e.hora_evento, TO_CHAR(e.fecha_evento, 'YYYY-MM-DD') AS fecha_evento, c.id_grupo
     FROM evento e
     INNER JOIN calendario c ON c.id_calendario = e.id_calendario
     WHERE NOT EXISTS (SELECT 1 FROM alerta_evento_enviada a WHERE a.id_evento = e.id_evento)`
  );

  for (const evento of eventos.rows) {
    const [anio, mes, dia] = evento.fecha_evento.split('-').map(Number);
    const [hh, mm] = String(evento.hora_evento).slice(0, 5).split(':').map(Number);
    const horaEvento = new Date(anio, mes - 1, dia, hh, mm, 0);
    const minutosParaElEvento = (horaEvento - ahora) / 60000;

    if (minutosParaElEvento > 60 || minutosParaElEvento <= 59) continue;

    const miembros = await pool.query(
      `SELECT u.push_token FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1`,
      [evento.id_grupo]
    );
    const reservado = await pool.query(
      'INSERT INTO alerta_evento_enviada (id_evento) VALUES ($1) ON CONFLICT (id_evento) DO NOTHING RETURNING id_evento',
      [evento.id_evento]
    );
    if (reservado.rows.length === 0) continue;

    const entrega = await enviarPushATokens(miembros.rows.map((m) => m.push_token), {
      title: 'Evento próximo',
      body: `${evento.nombre_evento} en 1 hora (${String(evento.hora_evento).slice(0, 5)})`,
      data: { tipo: 'evento', id_evento: evento.id_evento },
    });

    if (entrega.enviados === 0 && entrega.fallidos > 0) {
      await pool.query('DELETE FROM alerta_evento_enviada WHERE id_evento = $1', [evento.id_evento]);
    }
  }
};

const ejecutarCicloDeNotificaciones = async () => {
  if (cicloEnCurso) return;
  cicloEnCurso = true;
  try {
    for (const [nombre, tarea] of [
      ['bienestar', verificarAlertasBienestar],
      ['medicamentos', verificarRecordatoriosMedicamento],
      ['eventos', verificarRecordatoriosEvento],
    ]) {
      try {
        await tarea();
      } catch (error) {
        console.error(`Error al procesar notificaciones de ${nombre}:`, error.message);
      }
    }
  } finally {
    cicloEnCurso = false;
  }
};

const iniciarProgramadorNotificaciones = () => {
  if (intervaloProgramador) return intervaloProgramador;
  ejecutarCicloDeNotificaciones();
  intervaloProgramador = setInterval(ejecutarCicloDeNotificaciones, INTERVALO_MS);
  return intervaloProgramador;
};

module.exports = { iniciarProgramadorNotificaciones, ejecutarCicloDeNotificaciones };

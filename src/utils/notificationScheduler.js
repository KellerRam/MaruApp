// Programador en segundo plano (servidor) para alertas de bienestar, medicamentos y eventos.
// Se ejecuta en el proceso Node cada minuto; las notificaciones push llegan al dispositivo
// del usuario incluso si la app está cerrada, ya que el sistema operativo las entrega.
const pool = require('../config/db');
const { enviarPushATokens } = require('./pushNotifications');
const { obtenerHorariosPaciente } = require('./horariosBienestar');

const INTERVALO_MS = 60 * 1000;

// Bienestar: cada alerta (programada o solicitada por un miembro) se repite en el chat cada 5 min hasta confirmarse.
const MINUTOS_REPETICION_BIENESTAR = 5;
const MINUTOS_TOLERANCIA_INICIO_BIENESTAR = 10; // no se envía una alerta programada que ya pasó hace más de esto
const MINUTOS_LIMITE_BIENESTAR = 180; // deja de insistir tras 3 horas sin respuesta

// Medicamentos: aviso 15 min antes y recordatorio cada 10 min hasta que cualquier miembro confirme.
const MINUTOS_ANTICIPACION_MEDICAMENTO = 15;
const MINUTOS_REINTENTO_MEDICAMENTO = 10;
const MINUTOS_VENTANA_MEDICAMENTO_MAX = 180; // deja de reintentar tras 3 horas de la toma

// Eventos: un solo aviso, 1 hora antes (se acepta un margen por si el ciclo se retrasa).
const MINUTOS_AVISO_EVENTO = 60;
const MINUTOS_MARGEN_AVISO_EVENTO = 15;

let cicloEnCurso = false;
let intervaloProgramador = null;

const fechaLocalISO = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const horaLocalTexto = (fecha) =>
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

const esTokenValido = (token) => typeof token === 'string' && token.startsWith('ExponentPushToken');

const obtenerAlerta = async (tipo, clave) => {
  const resultado = await pool.query(
    `SELECT id_alerta, id_usuario, primer_envio, ultimo_envio, leida
     FROM alerta_notificacion WHERE tipo = $1 AND clave_ocurrencia = $2 LIMIT 1`,
    [tipo, clave]
  );
  return resultado.rows[0] || null;
};

// Reserva la ocurrencia (evita enviarla dos veces). Devuelve true si esta ejecución la creó.
const reservarAlerta = async (tipo, idUsuario, clave) => {
  const resultado = await pool.query(
    `INSERT INTO alerta_notificacion (tipo, id_usuario, clave_ocurrencia)
     VALUES ($1, $2, $3) ON CONFLICT (tipo, id_usuario, clave_ocurrencia) DO NOTHING
     RETURNING id_alerta`,
    [tipo, idUsuario, clave]
  );
  return resultado.rows.length > 0;
};

const liberarAlerta = (tipo, clave) =>
  pool.query('DELETE FROM alerta_notificacion WHERE tipo = $1 AND clave_ocurrencia = $2', [tipo, clave]);

// Marca un nuevo envío solo si ya pasaron `minutos` desde el anterior y la alerta sigue sin confirmar.
const reclamarReenvio = async (tipo, clave, minutos) => {
  const resultado = await pool.query(
    `UPDATE alerta_notificacion
     SET ultimo_envio = CURRENT_TIMESTAMP, intentos = intentos + 1
     WHERE tipo = $1 AND clave_ocurrencia = $2 AND leida = false
       AND ultimo_envio <= CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 minute')
     RETURNING id_alerta`,
    [tipo, clave, minutos]
  );
  return resultado.rows.length > 0;
};

// preferencia (opcional): columna de usuario que debe estar activa para recibir este tipo de aviso.
const PREFERENCIAS_VALIDAS = ['notif_medicamentos', 'notif_eventos'];
const obtenerMiembrosConToken = async (idGrupo, preferencia = null) => {
  const filtro = PREFERENCIAS_VALIDAS.includes(preferencia) ? `AND u.${preferencia} = true` : '';
  const miembros = await pool.query(
    `SELECT u.id_usuario, u.push_token FROM grupo_usuario gu
     INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
     WHERE gu.id_grupo = $1 ${filtro} ORDER BY u.id_usuario`,
    [idGrupo]
  );
  return miembros.rows;
};

// ---------------------------------------------------------------------------
// ALERTA DE BIENESTAR
// ---------------------------------------------------------------------------

// 1) Crea y envía al paciente las alertas programadas cuya hora ya llegó.
const enviarAlertasBienestarProgramadas = async () => {
  const pacientes = await pool.query(
    `SELECT p.id_usuario, p.bienestar_frecuencia, p.bienestar_horarios, u.push_token
     FROM paciente p
     INNER JOIN usuario u ON u.id_usuario = p.id_usuario
     WHERE p.confirmacion_bienestar = true AND u.correo IS NOT NULL`
  );

  const ahora = new Date();
  const hoyISO = fechaLocalISO(ahora);

  for (const paciente of pacientes.rows) {
    if (!esTokenValido(paciente.push_token)) continue; // sin dispositivo no hay a quién avisar

    for (const horario of obtenerHorariosPaciente(paciente)) {
      const [hh, mm] = horario.split(':').map(Number);
      const horaSlot = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0);
      const minutosDesdeLaHora = (ahora - horaSlot) / 60000;
      if (minutosDesdeLaHora < 0 || minutosDesdeLaHora > MINUTOS_TOLERANCIA_INICIO_BIENESTAR) continue;

      const clave = `auto-${hoyISO}-${horario}`;
      if (!(await reservarAlerta('bienestar', paciente.id_usuario, clave))) continue;

      const entrega = await enviarPushATokens([paciente.push_token], {
        title: 'Alerta de bienestar',
        body: 'Toca para confirmar que estás bien.',
        data: { tipo: 'bienestar', clave_ocurrencia: clave },
        categoryId: 'bienestar',
      });
      if (entrega.enviados === 0) await liberarAlerta('bienestar', clave); // se reintenta en el siguiente ciclo
    }
  }
};

// 2) Cada 5 minutos, mientras el paciente no confirme: avisa en el chat del grupo y vuelve a avisar al paciente.
const darSeguimientoBienestar = async () => {
  const pendientes = await pool.query(
    `SELECT a.clave_ocurrencia, a.primer_envio, a.id_usuario, u.push_token, u.nombre_usuario, gu.id_grupo
     FROM alerta_notificacion a
     INNER JOIN usuario u ON u.id_usuario = a.id_usuario
     INNER JOIN grupo_usuario gu ON gu.id_usuario = a.id_usuario
     WHERE a.tipo = 'bienestar' AND a.leida = false
       AND a.primer_envio > CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute')
       AND a.ultimo_envio <= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 minute')`,
    [MINUTOS_LIMITE_BIENESTAR, MINUTOS_REPETICION_BIENESTAR]
  );

  for (const alerta of pendientes.rows) {
    if (!(await reclamarReenvio('bienestar', alerta.clave_ocurrencia, MINUTOS_REPETICION_BIENESTAR))) continue;

    const horaAlerta = horaLocalTexto(new Date(alerta.primer_envio));
    const mensaje = `⚠️ ${alerta.nombre_usuario} (paciente) aún no ha confirmado su bienestar (alerta de las ${horaAlerta}).`;
    await pool.query(
      `INSERT INTO chat_mensaje (id_grupo, id_usuario, tipo, texto) VALUES ($1, $2, 'texto', $3)`,
      [alerta.id_grupo, alerta.id_usuario, mensaje]
    );

    // Vuelve a avisar al paciente (puede confirmar tocando la notificación)
    await enviarPushATokens([alerta.push_token], {
      title: 'Alerta de bienestar',
      body: 'Aún no has confirmado tu bienestar. Toca para confirmar.',
      data: { tipo: 'bienestar', clave_ocurrencia: alerta.clave_ocurrencia },
      categoryId: 'bienestar',
    });

    // Avisa al resto del grupo
    const miembros = await obtenerMiembrosConToken(alerta.id_grupo);
    await enviarPushATokens(
      miembros.filter((m) => m.id_usuario !== alerta.id_usuario).map((m) => m.push_token),
      {
        title: '⚠️ Bienestar sin confirmar',
        body: mensaje,
        data: { tipo: 'bienestar_escalada', id_grupo: alerta.id_grupo },
      }
    );
  }
};

const verificarAlertasBienestar = async () => {
  await enviarAlertasBienestarProgramadas();
  await darSeguimientoBienestar();
};

// ---------------------------------------------------------------------------
// RECORDATORIOS DE MEDICAMENTO (para todos los miembros del grupo, cualquiera puede confirmar)
// ---------------------------------------------------------------------------
const verificarRecordatoriosMedicamento = async () => {
  const ahora = new Date();
  const tomas = await pool.query(
    `SELECT hm.id_horario_medicamento, hm.hora_toma, TO_CHAR(hm.fecha_toma, 'YYYY-MM-DD') AS fecha_toma,
            m.nombre_medicamento, m.dosis, m.id_grupo
     FROM horario_medicamento hm
     INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento
     WHERE hm.fecha_toma BETWEEN CURRENT_DATE - 2 AND CURRENT_DATE + 2`
  );

  for (const toma of tomas.rows) {
    const [anio, mes, dia] = toma.fecha_toma.split('-').map(Number);
    const [hh, mm] = String(toma.hora_toma).slice(0, 5).split(':').map(Number);
    const horaToma = new Date(anio, mes - 1, dia, hh, mm, 0);
    const minutosParaLaToma = (horaToma - ahora) / 60000;
    const minutosDesdeLaToma = (ahora - horaToma) / 60000;

    if (minutosParaLaToma > MINUTOS_ANTICIPACION_MEDICAMENTO) continue;
    if (minutosDesdeLaToma > MINUTOS_VENTANA_MEDICAMENTO_MAX) continue;

    const clave = `hm-${toma.id_horario_medicamento}`;
    const detalle = `${toma.nombre_medicamento} (${toma.dosis})`;
    const datos = { tipo: 'medicamento', clave_ocurrencia: clave };
    const existente = await obtenerAlerta('medicamento', clave);

    if (!existente) {
      const miembros = await obtenerMiembrosConToken(toma.id_grupo, 'notif_medicamentos');
      const tokens = miembros.map((m) => m.push_token).filter(esTokenValido);
      if (tokens.length === 0) continue;

      // El registro de seguimiento se asocia a un miembro del grupo, pero lo puede confirmar cualquiera.
      if (!(await reservarAlerta('medicamento', miembros[0].id_usuario, clave))) continue;

      const minutosRestantes = Math.ceil(minutosParaLaToma);
      const cuerpo = minutosRestantes > 0
        ? `En ${minutosRestantes} min toca: ${detalle}`
        : `Es hora de tomar: ${detalle}`;
      const entrega = await enviarPushATokens(tokens, {
        title: 'Recordatorio de medicamento',
        body: cuerpo,
        data: datos,
        categoryId: 'medicamento',
      });
      if (entrega.enviados === 0) await liberarAlerta('medicamento', clave);
      continue;
    }

    if (existente.leida) continue;
    if (!(await reclamarReenvio('medicamento', clave, MINUTOS_REINTENTO_MEDICAMENTO))) continue;

    const miembros = await obtenerMiembrosConToken(toma.id_grupo, 'notif_medicamentos');
    await enviarPushATokens(miembros.map((m) => m.push_token), {
      title: 'Recordatorio de medicamento',
      body: `Aún no se confirma la toma: ${detalle}`,
      data: datos,
      categoryId: 'medicamento',
    });
  }
};

// ---------------------------------------------------------------------------
// RECORDATORIO DE EVENTOS (una sola vez, 1 hora antes, sin confirmación)
// ---------------------------------------------------------------------------
const verificarRecordatoriosEvento = async () => {
  const ahora = new Date();
  const eventos = await pool.query(
    `SELECT e.id_evento, e.nombre_evento, e.hora_evento, TO_CHAR(e.fecha_evento, 'YYYY-MM-DD') AS fecha_evento, c.id_grupo
     FROM evento e
     INNER JOIN calendario c ON c.id_calendario = e.id_calendario
     WHERE e.fecha_evento BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2
       AND NOT EXISTS (SELECT 1 FROM alerta_evento_enviada a WHERE a.id_evento = e.id_evento)`
  );

  for (const evento of eventos.rows) {
    const [anio, mes, dia] = evento.fecha_evento.split('-').map(Number);
    const [hh, mm] = String(evento.hora_evento).slice(0, 5).split(':').map(Number);
    const horaEvento = new Date(anio, mes - 1, dia, hh, mm, 0);
    const minutosParaElEvento = (horaEvento - ahora) / 60000;

    if (minutosParaElEvento > MINUTOS_AVISO_EVENTO || minutosParaElEvento <= MINUTOS_AVISO_EVENTO - MINUTOS_MARGEN_AVISO_EVENTO) continue;

    const miembros = await obtenerMiembrosConToken(evento.id_grupo, 'notif_eventos');
    const reservado = await pool.query(
      'INSERT INTO alerta_evento_enviada (id_evento) VALUES ($1) ON CONFLICT (id_evento) DO NOTHING RETURNING id_evento',
      [evento.id_evento]
    );
    if (reservado.rows.length === 0) continue;

    const entrega = await enviarPushATokens(miembros.map((m) => m.push_token), {
      title: 'Evento próximo',
      body: `${evento.nombre_evento} ${minutosParaElEvento >= 55 ? 'en 1 hora' : `en ${Math.round(minutosParaElEvento)} minutos`} (${String(evento.hora_evento).slice(0, 5)})`,
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

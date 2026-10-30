// controllers/notificationController.js
const pool = require('../config/db');
const { enviarPushATokens } = require('../utils/pushNotifications');
const { normalizarHorarios, obtenerHorariosPaciente, MAXIMO_ALERTAS_POR_DIA } = require('../utils/horariosBienestar');

const MINUTOS_LIMITE_BIENESTAR = 180;

const horaLocalTexto = (fecha) =>
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

// Obtener preferencias de notificaciones del paciente
const obtenerPreferencias = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const resultado = await pool.query(
      'SELECT confirmacion_bienestar, bienestar_frecuencia, bienestar_horarios FROM paciente WHERE id_usuario = $1',
      [id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const horarios = obtenerHorariosPaciente(resultado.rows[0]);
    res.json({
      confirmacion_bienestar: resultado.rows[0].confirmacion_bienestar,
      frecuencia: horarios.length,
      horarios,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar confirmacion_bienestar y las horas diarias de alerta (máximo 5)
const actualizarBienestar = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { confirmacion_bienestar, frecuencia, horarios } = req.body || {};

    let horariosGuardados;
    if (horarios !== undefined) {
      horariosGuardados = normalizarHorarios(horarios);
      if (!horariosGuardados) {
        return res.status(400).json({ error: `Indica de 1 a ${MAXIMO_ALERTAS_POR_DIA} horas válidas (HH:MM) sin repetir` });
      }
    } else {
      // Compatibilidad: solo se envió la cantidad de alertas
      const cantidad = Math.min(MAXIMO_ALERTAS_POR_DIA, Math.max(1, parseInt(frecuencia, 10) || 1));
      horariosGuardados = obtenerHorariosPaciente({ bienestar_horarios: null, bienestar_frecuencia: cantidad });
    }

    const actualizado = await pool.query(
      `UPDATE paciente
       SET confirmacion_bienestar = $1, bienestar_frecuencia = $2, bienestar_horarios = $3
       WHERE id_usuario = $4 RETURNING id_usuario`,
      [Boolean(confirmacion_bienestar), horariosGuardados.length, horariosGuardados.join(','), id_usuario]
    );
    if (actualizado.rows.length === 0) {
      return res.status(403).json({ error: 'Solo el paciente puede configurar la alerta de bienestar' });
    }

    res.json({ mensaje: 'Preferencia de bienestar actualizada correctamente', horarios: horariosGuardados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Preferencias de notificaciones de cualquier usuario (se guardan en el servidor para que persistan)
const obtenerAjustes = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT notif_medicamentos, notif_eventos, notif_emergencia FROM usuario WHERE id_usuario = $1',
      [req.params.id_usuario]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const fila = resultado.rows[0];
    res.json({
      medicamentos: fila.notif_medicamentos,
      eventos: fila.notif_eventos,
      emergencia: fila.notif_emergencia,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarAjustes = async (req, res) => {
  try {
    const campos = { medicamentos: 'notif_medicamentos', eventos: 'notif_eventos', emergencia: 'notif_emergencia' };
    const sets = [];
    const valores = [];
    for (const [clave, columna] of Object.entries(campos)) {
      if (typeof req.body?.[clave] === 'boolean') {
        valores.push(req.body[clave]);
        sets.push(`${columna} = $${valores.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No se indicó ninguna preferencia válida' });

    valores.push(req.params.id_usuario);
    await pool.query(`UPDATE usuario SET ${sets.join(', ')} WHERE id_usuario = $${valores.length}`, valores);
    res.json({ mensaje: 'Preferencias guardadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Guarda o actualiza el token de notificaciones push del dispositivo del usuario
const guardarTokenPush = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { push_token } = req.body || {};

    if (!push_token) {
      return res.status(400).json({ error: 'El token push es obligatorio' });
    }

    // Un dispositivo pertenece a una sola cuenta: se desvincula de cualquier otra que lo tuviera
    await pool.query('UPDATE usuario SET push_token = NULL WHERE push_token = $1 AND id_usuario <> $2', [push_token, id_usuario]);
    await pool.query('UPDATE usuario SET push_token = $1 WHERE id_usuario = $2', [push_token, id_usuario]);
    res.status(200).json({ mensaje: 'Token push registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Al cerrar sesión el dispositivo deja de recibir las notificaciones de esa cuenta
const eliminarTokenPush = async (req, res) => {
  try {
    await pool.query('UPDATE usuario SET push_token = NULL WHERE id_usuario = $1', [req.params.id_usuario]);
    res.status(200).json({ mensaje: 'Token push eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cualquier miembro del grupo puede pedir al paciente que confirme su bienestar
const solicitarAlertaBienestar = async (req, res) => {
  try {
    const idGrupo = Number(req.body?.id_grupo);
    if (!Number.isInteger(idGrupo) || idGrupo <= 0) {
      return res.status(400).json({ error: 'El grupo es obligatorio' });
    }

    const pacienteRes = await pool.query(
      `SELECT u.id_usuario, u.nombre_usuario, u.push_token, u.correo
       FROM grupo_usuario gu
       INNER JOIN usuario u ON u.id_usuario = gu.id_usuario
       LEFT JOIN paciente p ON p.id_usuario = gu.id_usuario
       WHERE gu.id_grupo = $1 AND (p.id_usuario IS NOT NULL OR gu.rol = 'paciente')
       LIMIT 1`,
      [idGrupo]
    );
    if (pacienteRes.rows.length === 0) {
      return res.status(409).json({ error: 'El grupo no tiene un paciente asignado' });
    }

    const paciente = pacienteRes.rows[0];
    if (!paciente.correo || typeof paciente.push_token !== 'string' || !paciente.push_token.startsWith('ExponentPushToken')) {
      return res.status(409).json({ error: 'El paciente no cuenta con un dispositivo con notificaciones activas' });
    }

    const pendiente = await pool.query(
      `SELECT 1 FROM alerta_notificacion
       WHERE tipo = 'bienestar' AND id_usuario = $1 AND leida = false
         AND primer_envio > CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 minute')
       LIMIT 1`,
      [paciente.id_usuario, MINUTOS_LIMITE_BIENESTAR]
    );
    if (pendiente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya hay una alerta de bienestar pendiente de confirmar' });
    }

    const clave = `manual-${Date.now()}`;
    await pool.query(
      `INSERT INTO alerta_notificacion (tipo, id_usuario, clave_ocurrencia) VALUES ('bienestar', $1, $2)`,
      [paciente.id_usuario, clave]
    );

    const entrega = await enviarPushATokens([paciente.push_token], {
      title: 'Alerta de bienestar',
      body: 'Toca para confirmar que estás bien.',
      data: { tipo: 'bienestar', clave_ocurrencia: clave },
      categoryId: 'bienestar',
    });
    if (entrega.enviados === 0) {
      await pool.query(`DELETE FROM alerta_notificacion WHERE tipo = 'bienestar' AND clave_ocurrencia = $1`, [clave]);
      return res.status(502).json({ error: 'No se pudo enviar la notificación al paciente. Intenta de nuevo.' });
    }

    res.status(200).json({ mensaje: 'Alerta de bienestar enviada al paciente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Confirma una alerta y detiene los reintentos.
// - bienestar: solo la confirma el paciente al que se le envió; se avisa en el chat del grupo.
// - medicamento: la confirma cualquier miembro del grupo.
const confirmarAlerta = async (req, res) => {
  try {
    const { tipo, id_usuario, clave_ocurrencia } = req.body || {};
    if (!tipo || !id_usuario || !clave_ocurrencia) {
      return res.status(400).json({ error: 'tipo, id_usuario y clave_ocurrencia son obligatorios' });
    }

    if (tipo === 'bienestar') {
      const confirmada = await pool.query(
        `UPDATE alerta_notificacion SET leida = true
         WHERE tipo = 'bienestar' AND id_usuario = $1 AND clave_ocurrencia = $2 AND leida = false
         RETURNING id_alerta`,
        [id_usuario, clave_ocurrencia]
      );

      if (confirmada.rows.length === 0) {
        const existe = await pool.query(
          `SELECT 1 FROM alerta_notificacion WHERE tipo = 'bienestar' AND id_usuario = $1 AND clave_ocurrencia = $2`,
          [id_usuario, clave_ocurrencia]
        );
        if (existe.rows.length === 0) {
          return res.status(404).json({ error: 'La alerta no existe o no está dirigida a ti' });
        }
        return res.status(200).json({ mensaje: 'La alerta ya estaba confirmada', yaConfirmada: true });
      }

      const grupoRes = await pool.query('SELECT id_grupo FROM grupo_usuario WHERE id_usuario = $1 LIMIT 1', [id_usuario]);
      if (grupoRes.rows.length > 0) {
        await pool.query(
          `INSERT INTO chat_mensaje (id_grupo, id_usuario, tipo, texto) VALUES ($1, $2, 'texto', $3)`,
          [grupoRes.rows[0].id_grupo, id_usuario, `✅ El paciente confirmó su bienestar a las ${horaLocalTexto(new Date())}.`]
        );
      }
      return res.status(200).json({ mensaje: 'Bienestar confirmado' });
    }

    if (tipo === 'medicamento') {
      const coincidencia = /^hm-(\d+)$/.exec(String(clave_ocurrencia));
      if (!coincidencia) return res.status(400).json({ error: 'La clave de la toma no es válida' });

      const pertenece = await pool.query(
        `SELECT 1 FROM horario_medicamento hm
         INNER JOIN medicamento m ON m.id_medicamento = hm.id_medicamento
         INNER JOIN grupo_usuario gu ON gu.id_grupo = m.id_grupo
         WHERE hm.id_horario_medicamento = $1 AND gu.id_usuario = $2`,
        [coincidencia[1], id_usuario]
      );
      if (pertenece.rows.length === 0) {
        return res.status(403).json({ error: 'Esta toma no pertenece a tu grupo' });
      }

      await pool.query(
        `UPDATE alerta_notificacion SET leida = true WHERE tipo = 'medicamento' AND clave_ocurrencia = $1`,
        [clave_ocurrencia]
      );
      return res.status(200).json({ mensaje: 'Toma confirmada' });
    }

    return res.status(400).json({ error: 'Tipo de alerta no válido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  obtenerPreferencias,
  actualizarBienestar,
  obtenerAjustes,
  actualizarAjustes,
  guardarTokenPush,
  eliminarTokenPush,
  solicitarAlertaBienestar,
  confirmarAlerta,
};

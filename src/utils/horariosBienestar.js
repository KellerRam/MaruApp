// Horas de la alerta de bienestar: validación y lectura. Se guardan como "HH:MM,HH:MM" (máximo 5).
const HORARIOS_PREDETERMINADOS = ['08:00', '12:00', '16:00', '19:00', '22:00'];
const MAXIMO_ALERTAS_POR_DIA = 5;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Devuelve la lista ordenada y sin repetidos, o null si algún valor no es una hora HH:MM válida.
const normalizarHorarios = (valor) => {
  if (!Array.isArray(valor)) return null;
  const horas = valor.map((hora) => (typeof hora === 'string' ? hora.trim().slice(0, 5) : ''));
  if (horas.some((hora) => !FORMATO_HORA.test(hora))) return null;
  const unicas = [...new Set(horas)].sort();
  if (unicas.length < 1 || unicas.length > MAXIMO_ALERTAS_POR_DIA) return null;
  return unicas;
};

// Horas efectivas de un paciente: las personalizadas o, si no hay, las predeterminadas según su frecuencia.
const obtenerHorariosPaciente = ({ bienestar_horarios: guardados, bienestar_frecuencia: frecuencia }) => {
  const personalizados = typeof guardados === 'string' && guardados.trim()
    ? normalizarHorarios(guardados.split(','))
    : null;
  if (personalizados) return personalizados;
  const cantidad = Math.min(MAXIMO_ALERTAS_POR_DIA, Math.max(1, Number(frecuencia) || 1));
  return HORARIOS_PREDETERMINADOS.slice(0, cantidad);
};

module.exports = { HORARIOS_PREDETERMINADOS, MAXIMO_ALERTAS_POR_DIA, normalizarHorarios, obtenerHorariosPaciente };

// Envía notificaciones push usando el servicio de Expo (https://exp.host/--/api/v2/push/send)
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TAMANIO_LOTE = 100;

const esTokenExpoValido = (token) => typeof token === 'string' && token.startsWith('ExponentPushToken');

const enviarPushATokens = async (tokens, { title, body, data = {}, sound = 'default', priority = 'high' }) => {
  const tokensValidos = [...new Set((tokens || []).filter(esTokenExpoValido))];
  if (tokensValidos.length === 0) return { enviados: 0, fallidos: 0 };

  const mensajes = tokensValidos.map((to) => ({ to, title, body, data, sound, priority }));
  let enviados = 0;
  let fallidos = 0;

  for (let i = 0; i < mensajes.length; i += TAMANIO_LOTE) {
    const lote = mensajes.slice(i, i + TAMANIO_LOTE);
    try {
      const respuesta = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lote),
      });
      if (!respuesta.ok) throw new Error(`Expo Push respondió HTTP ${respuesta.status}`);

      const resultado = await respuesta.json();
      if (!Array.isArray(resultado.data) || resultado.data.length !== lote.length) {
        throw new Error('Expo Push devolvió una respuesta incompleta');
      }
      enviados += resultado.data.filter((ticket) => ticket.status === 'ok').length;
      fallidos += resultado.data.filter((ticket) => ticket.status !== 'ok').length;
    } catch (error) {
      fallidos += lote.length;
      console.error('Error al enviar notificaciones push:', error.message);
    }
  }

  return { enviados, fallidos };
};

module.exports = { enviarPushATokens };

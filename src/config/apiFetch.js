import { API_URL } from './api';
import { esErrorDeSesion, expirarSesion, obtenerToken } from '../utils/session';

const API_BASE = API_URL.replace(/\/+$/, '');
// Evita que una petición colgada bloquee sondeos y pantallas indefinidamente.
const TIEMPO_MAXIMO_LECTURA_MS = 20000;
const TIEMPO_MAXIMO_ESCRITURA_MS = 90000; // subidas de imágenes/audio

export const apiFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url;
  const esSolicitudAPI = typeof url === 'string' && (url === API_BASE || url.startsWith(`${API_BASE}/`));
  if (!esSolicitudAPI) return globalThis.fetch(input, init);

  const headers = new Headers(typeof input === 'string' ? init.headers : input.headers);
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  let tokenAdjuntado = null;
  if (!headers.has('Authorization')) {
    const token = await obtenerToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      tokenAdjuntado = token;
    }
  }

  const metodo = String(init.method || (typeof input === 'string' ? 'GET' : input?.method) || 'GET').toUpperCase();
  const controlador = new AbortController();
  if (init.signal) {
    if (init.signal.aborted) controlador.abort();
    else init.signal.addEventListener('abort', () => controlador.abort(), { once: true });
  }
  const temporizador = setTimeout(
    () => controlador.abort(),
    metodo === 'GET' ? TIEMPO_MAXIMO_LECTURA_MS : TIEMPO_MAXIMO_ESCRITURA_MS
  );

  let respuesta;
  try {
    respuesta = await globalThis.fetch(input, { ...init, headers, signal: controlador.signal });
  } finally {
    clearTimeout(temporizador);
  }

  // Token vencido o inválido: se cierra la sesión local para no quedar en un estado inconsistente.
  if (respuesta.status === 401 && tokenAdjuntado) {
    const datos = await respuesta.clone().json().catch(() => null);
    if (esErrorDeSesion(datos?.error)) expirarSesion(tokenAdjuntado);
  }
  return respuesta;
};

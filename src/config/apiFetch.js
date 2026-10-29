import { API_URL } from './api';
import { expirarSesion, obtenerToken } from '../utils/session';

const API_BASE = API_URL.replace(/\/+$/, '');

export const apiFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url;
  const esSolicitudAPI = typeof url === 'string' && (url === API_BASE || url.startsWith(`${API_BASE}/`));
  if (!esSolicitudAPI) return globalThis.fetch(input, init);

  const headers = new Headers(typeof input === 'string' ? init.headers : input.headers);
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  const tieneAutorizacion = headers.has('Authorization');
  let tokenAdjuntado = null;
  if (!tieneAutorizacion) {
    const token = await obtenerToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      tokenAdjuntado = token;
    }
  }

  const respuesta = await globalThis.fetch(input, { ...init, headers });
  // Token vencido o inválido: se cierra la sesión local para no quedar en un estado inconsistente.
  if (respuesta.status === 401 && tokenAdjuntado) expirarSesion(tokenAdjuntado);
  return respuesta;
};

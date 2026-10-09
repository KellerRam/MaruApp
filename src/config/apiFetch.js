import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { cerrarSesion } from '../utils/session';
import { API_URL } from './api';

const API_BASE = API_URL.replace(/\/+$/, '');
let sesionExpirada = false;
const TIEMPO_MAXIMO_MS = 80000;

export const apiFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url;
  const esSolicitudAPI = typeof url === 'string' && (url === API_BASE || url.startsWith(`${API_BASE}/`));
  if (!esSolicitudAPI) return globalThis.fetch(input, init);

  const headers = new Headers(typeof input === 'string' ? init.headers : input.headers);
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  const tieneAutorizacion = headers.has('Authorization');
  let tokenEnviado = tieneAutorizacion;
  if (!tieneAutorizacion) {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        tokenEnviado = true;
      }
    } catch (error) {
      console.warn('No se pudo recuperar el token de sesión:', error.message);
    }
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  const cancelarExterno = init.signal;
  if (cancelarExterno) {
    if (cancelarExterno.aborted) controlador.abort();
    else cancelarExterno.addEventListener('abort', () => controlador.abort(), { once: true });
  }

  let respuesta;
  try {
    respuesta = await globalThis.fetch(input, { ...init, headers, signal: controlador.signal });
  } catch (error) {
    const tipo = error?.name === 'AbortError' ? 'timeout' : /Network request failed/i.test(error?.message || '') ? 'red/ATS/DNS/TLS' : 'otro';
    console.warn(`[apiFetch] ${init.method || 'GET'} ${url} falló (${tipo}): ${error?.name}: ${error?.message}`);
    if (error?.name === 'AbortError' && !cancelarExterno?.aborted) {
      throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
  if (!respuesta.ok) console.warn(`[apiFetch] ${init.method || 'GET'} ${url} -> HTTP ${respuesta.status}`);

  // Con la sesión persistida, un 401 significa que el JWT caducó. Las rutas /api/auth/ usan 401 para otros fallos.
  if (respuesta.status === 401 && tokenEnviado && !url.includes('/api/auth/') && !sesionExpirada) {
    sesionExpirada = true;
    try {
      await cerrarSesion();
      router.replace('/login');
    } finally {
      sesionExpirada = false;
    }
  }
  return respuesta;
};

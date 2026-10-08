import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { cerrarSesion } from '../utils/session';
import { API_URL } from './api';

const API_BASE = API_URL.replace(/\/+$/, '');
let sesionExpirada = false;
const TIEMPO_MAXIMO_MS = 20000;

export const apiFetch = async (input, init = {}) => {
  // Aseguramos que la URL sea siempre una cadena limpia
  const url = typeof input === 'string' ? input : (input?.url || '');
  const esSolicitudAPI = url.startsWith(API_BASE) || url === API_BASE;

  if (!esSolicitudAPI) {
    return globalThis.fetch(input, init);
  }

  // Preparamos los headers de forma segura para iOS y Android
  const headers = new Headers(init.headers || {});
  
  let tokenEnviado = headers.has('Authorization');
  if (!tokenEnviado) {
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

  // Añadimos Content-Type por defecto si es un método con cuerpo y no viene definido
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
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
    // Hacemos la petición pasando la URL limpia como string y los headers normalizados
    respuesta = await globalThis.fetch(url, {
      ...init,
      headers,
      signal: controlador.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError' && !cancelarExterno?.aborted) {
      throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }

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
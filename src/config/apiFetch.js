import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

const API_BASE = API_URL.replace(/\/+$/, '');

export const apiFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url;
  const esSolicitudAPI = typeof url === 'string' && (url === API_BASE || url.startsWith(`${API_BASE}/`));
  if (!esSolicitudAPI) return globalThis.fetch(input, init);

  const headers = new Headers(typeof input === 'string' ? init.headers : input.headers);
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  const tieneAutorizacion = headers.has('Authorization');
  if (!tieneAutorizacion) {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch (error) {
      console.warn('No se pudo recuperar el token de sesión:', error.message);
    }
  }

  return globalThis.fetch(input, { ...init, headers });
};

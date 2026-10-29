import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../config/api';

const CLAVE_TOKEN = 'userToken';
const CLAVE_ID_USUARIO = 'userId';
const CLAVE_TIENE_GRUPO = 'tieneGrupo';
const CLAVE_ID_GRUPO = 'groupId';
const API_BASE = API_URL.replace(/\/+$/, '');

// En Android (Keystore) e iOS (Keychain) el token vive en el almacén seguro nativo.
// En web no existe, por lo que se usa AsyncStorage como alternativa.
const usaAlmacenSeguro = Platform.OS !== 'web';
const opcionesSeguras = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const oyentes = new Set();
const oyentesExpiracion = new Set();
let cerrandoPorExpiracion = false;

// Permite que componentes montados descarten su estado en memoria al cerrar sesión.
export const alCerrarSesion = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

// Permite a la navegación reaccionar cuando el servidor invalida la sesión (token vencido).
export const alExpirarSesion = (oyente) => {
  oyentesExpiracion.add(oyente);
  return () => oyentesExpiracion.delete(oyente);
};

const leerTokenAlmacenado = async () => {
  if (usaAlmacenSeguro) {
    try {
      const token = await SecureStore.getItemAsync(CLAVE_TOKEN, opcionesSeguras);
      if (token) return token;
    } catch (error) {
      console.warn('No se pudo leer el almacén seguro:', error.message);
    }
  }
  // Sesiones anteriores guardaban el token en AsyncStorage: se migran al almacén seguro.
  const heredado = await AsyncStorage.getItem(CLAVE_TOKEN);
  if (heredado && usaAlmacenSeguro) {
    try {
      await SecureStore.setItemAsync(CLAVE_TOKEN, heredado, opcionesSeguras);
      await AsyncStorage.removeItem(CLAVE_TOKEN);
    } catch (error) {
      console.warn('No se pudo migrar el token al almacén seguro:', error.message);
    }
  }
  return heredado;
};

const decodificarPayload = (token) => {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = parte + '='.repeat((4 - (parte.length % 4)) % 4);
    return JSON.parse(globalThis.atob(relleno));
  } catch {
    return null;
  }
};

// Si el token no se puede decodificar se considera vigente: el servidor decide con un 401.
const tokenVencido = (token) => {
  const exp = decodificarPayload(token)?.exp;
  return typeof exp === 'number' && exp * 1000 <= Date.now();
};

export const obtenerToken = async () => {
  try {
    return await leerTokenAlmacenado();
  } catch (error) {
    console.warn('No se pudo recuperar el token de sesión:', error.message);
    return null;
  }
};

export const guardarSesion = async ({ token, idUsuario, tieneGrupo = false }) => {
  cerrandoPorExpiracion = false;
  let guardadoSeguro = false;
  if (usaAlmacenSeguro) {
    try {
      await SecureStore.setItemAsync(CLAVE_TOKEN, token, opcionesSeguras);
      await AsyncStorage.removeItem(CLAVE_TOKEN);
      guardadoSeguro = true;
    } catch (error) {
      console.warn('Almacén seguro no disponible, se usa almacenamiento local:', error.message);
    }
  }
  if (!guardadoSeguro) await AsyncStorage.setItem(CLAVE_TOKEN, token);
  await AsyncStorage.multiSet([
    [CLAVE_ID_USUARIO, String(idUsuario)],
    [CLAVE_TIENE_GRUPO, tieneGrupo ? 'true' : 'false'],
  ]);
};

// Devuelve la sesión persistida o null si no existe, está incompleta o el token ya venció.
export const obtenerSesion = async () => {
  const token = await obtenerToken();
  const [[, idUsuario], [, tieneGrupoGuardado], [, idGrupo]] = await AsyncStorage.multiGet([
    CLAVE_ID_USUARIO,
    CLAVE_TIENE_GRUPO,
    CLAVE_ID_GRUPO,
  ]);
  if (!token || !idUsuario) return null;
  if (tokenVencido(token)) {
    await cerrarSesion({ notificarServidor: false });
    return null;
  }
  return { token, idUsuario, tieneGrupo: tieneGrupoGuardado === 'true' || Boolean(idGrupo) };
};

// Desvincula el dispositivo del usuario para que no reciba alertas de una cuenta ya cerrada.
const desregistrarTokenPush = async (idUsuario, token) => {
  if (!idUsuario || !token) return;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 4000);
  try {
    await globalThis.fetch(`${API_BASE}/api/notifications/push-token/${idUsuario}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: controlador.signal,
    });
  } catch (error) {
    console.warn('No se pudo desvincular el token push:', error.message);
  } finally {
    clearTimeout(temporizador);
  }
};

export const cerrarSesion = async ({ notificarServidor = true } = {}) => {
  oyentes.forEach((oyente) => {
    try {
      oyente();
    } catch (error) {
      console.warn('Error en oyente de cierre de sesión:', error.message);
    }
  });

  if (notificarServidor) {
    const [token, idUsuario] = await Promise.all([obtenerToken(), AsyncStorage.getItem(CLAVE_ID_USUARIO)]);
    await desregistrarTokenPush(idUsuario, token);
  }

  if (usaAlmacenSeguro) {
    try {
      await SecureStore.deleteItemAsync(CLAVE_TOKEN, opcionesSeguras);
    } catch (error) {
      console.warn('No se pudo borrar el token seguro:', error.message);
    }
  }
  await AsyncStorage.clear();
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    // Sin sesión de Google activa no hay nada que cerrar.
  }
};

// El servidor rechazó el token (401): se limpia la sesión una sola vez y se avisa a la navegación.
export const expirarSesion = async (tokenRechazado) => {
  if (cerrandoPorExpiracion) return;
  const tokenActual = await obtenerToken();
  if (!tokenActual || tokenActual !== tokenRechazado) return; // ya hubo un nuevo inicio de sesión
  cerrandoPorExpiracion = true;
  await cerrarSesion({ notificarServidor: false });
  oyentesExpiracion.forEach((oyente) => {
    try {
      oyente();
    } catch (error) {
      console.warn('Error en oyente de expiración de sesión:', error.message);
    }
  });
};

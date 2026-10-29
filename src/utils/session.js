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
// Mensajes de requireAuth: otros 401 (p. ej. contraseña incorrecta al borrar la cuenta) no cierran la sesión.
const MENSAJES_SESION_INVALIDA = ['Debes iniciar sesión', 'La sesión no es válida'];
export const esErrorDeSesion = (mensaje) =>
  typeof mensaje === 'string' && MENSAJES_SESION_INVALIDA.some((inicio) => mensaje.startsWith(inicio));

// En Android (Keystore) e iOS (Keychain) el token vive en el almacén seguro nativo.
// En web no existe, por lo que se usa AsyncStorage como alternativa.
const usaAlmacenSeguro = Platform.OS !== 'web';
const opcionesSeguras = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const oyentes = new Set();
const oyentesInicio = new Set();
const oyentesExpiracion = new Set();

// Estado en memoria: evita leer el Keychain en cada petición HTTP. Se invalida de forma síncrona
// al cerrar sesión; `generacion` descarta lecturas/escrituras pendientes de una sesión anterior.
let tokenEnMemoria = null;
let lecturaEnCurso = null;
let generacion = 0;
let cerrandoPorExpiracion = false;

// Permite que componentes montados descarten su estado en memoria al cerrar sesión.
export const alCerrarSesion = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

// Permite que componentes que siguen montados (Drawer/Tabs) recarguen sus datos al iniciar sesión.
export const alIniciarSesion = (oyente) => {
  oyentesInicio.add(oyente);
  return () => oyentesInicio.delete(oyente);
};

// Permite a la navegación reaccionar cuando el servidor invalida la sesión (token vencido).
export const alExpirarSesion = (oyente) => {
  oyentesExpiracion.add(oyente);
  return () => oyentesExpiracion.delete(oyente);
};

const notificar = (conjunto, etiqueta) => {
  conjunto.forEach((oyente) => {
    try {
      oyente();
    } catch (error) {
      console.warn(`Error en oyente de ${etiqueta}:`, error.message);
    }
  });
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// El Keychain puede rechazar lecturas de forma transitoria al arrancar la app (p. ej. antes del
// primer desbloqueo): se reintenta antes de dar la sesión por perdida.
const leerTokenSeguro = async () => {
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      return await SecureStore.getItemAsync(CLAVE_TOKEN, opcionesSeguras);
    } catch (error) {
      console.warn('No se pudo leer el almacén seguro:', error.message);
      if (intento < 2) await esperar(400);
    }
  }
  return null;
};

const leerTokenAlmacenado = async () => {
  if (usaAlmacenSeguro) {
    const token = await leerTokenSeguro();
    if (token) return token;
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

// Token de la sesión activa. Responde desde memoria; solo la primera vez (o tras reiniciar la app)
// lee el almacén seguro, y las lecturas simultáneas comparten una sola consulta.
export const obtenerToken = async () => {
  if (tokenEnMemoria) return tokenEnMemoria;
  if (!lecturaEnCurso) {
    const generacionLectura = generacion;
    lecturaEnCurso = leerTokenAlmacenado()
      .then((token) => {
        if (generacionLectura !== generacion) return null; // se cerró/abrió sesión mientras se leía
        if (token) tokenEnMemoria = token;
        return token;
      })
      .catch((error) => {
        console.warn('No se pudo recuperar el token de sesión:', error.message);
        return null;
      })
      .finally(() => {
        if (generacionLectura === generacion) lecturaEnCurso = null;
      });
  }
  return lecturaEnCurso;
};

export const guardarSesion = async ({ token, idUsuario, tieneGrupo = false }) => {
  cerrandoPorExpiracion = false;
  generacion += 1;
  lecturaEnCurso = null;
  tokenEnMemoria = token; // las peticiones inmediatas ya salen autenticadas

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
  notificar(oyentesInicio, 'inicio de sesión');
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

// Grupo del usuario autenticado: primero el guardado localmente y, si no existe (p. ej. tras
// iniciar sesión o restaurarla), se resuelve desde el servidor y se guarda para el resto de pantallas.
// Con `forzar` siempre consulta al servidor (para detectar que el usuario salió del grupo).
// Devuelve el id (string), null si el servidor confirma que no tiene grupo, o undefined si no se pudo saber.
export const obtenerIdGrupoActivo = async ({ forzar = false } = {}) => {
  const [[, idUsuario], [, guardado]] = await AsyncStorage.multiGet([CLAVE_ID_USUARIO, CLAVE_ID_GRUPO]);
  if (!idUsuario) return undefined;
  if (guardado && !forzar) return guardado;

  const token = await obtenerToken();
  if (!token) return undefined;
  const generacionConsulta = generacion;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 15000);
  try {
    const respuesta = await globalThis.fetch(`${API_BASE}/api/groups/user/${idUsuario}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        const datos = await respuesta.json().catch(() => null);
        if (esErrorDeSesion(datos?.error)) expirarSesion(token);
      }
      return forzar && guardado ? guardado : undefined;
    }
    const datos = await respuesta.json();
    if (generacionConsulta !== generacion) return undefined; // la sesión cambió mientras se consultaba
    const idGrupo = datos.grupo?.id_grupo?.toString();
    if (idGrupo) {
      await AsyncStorage.setItem(CLAVE_ID_GRUPO, idGrupo);
      return idGrupo;
    }
    // Sin grupo: se descarta el id guardado para no usar uno obsoleto
    await AsyncStorage.multiRemove([CLAVE_ID_GRUPO]);
    await AsyncStorage.setItem(CLAVE_TIENE_GRUPO, 'false');
    return null;
  } catch (error) {
    console.warn('No se pudo resolver el grupo del usuario:', error.message);
    return forzar && guardado ? guardado : undefined;
  } finally {
    clearTimeout(temporizador);
  }
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

// Limpieza local inmediata (memoria → listeners → almacenamiento); la red nunca bloquea el logout.
export const cerrarSesion = async ({ notificarServidor = true } = {}) => {
  // Datos necesarios para avisar al servidor, capturados antes de borrar nada.
  let tokenPrevio = tokenEnMemoria;
  let idUsuarioPrevio = null;
  if (notificarServidor) {
    tokenPrevio = tokenPrevio || (await obtenerToken());
    idUsuarioPrevio = await AsyncStorage.getItem(CLAVE_ID_USUARIO).catch(() => null);
  }

  // 1) Síncrono: ninguna petición posterior vuelve a salir con el token anterior.
  generacion += 1;
  tokenEnMemoria = null;
  lecturaEnCurso = null;

  // 2) Los componentes montados descartan su estado y detienen sus sondeos.
  notificar(oyentes, 'cierre de sesión');

  // 3) Almacenamiento persistente.
  const borrados = [AsyncStorage.clear()];
  if (usaAlmacenSeguro) borrados.push(SecureStore.deleteItemAsync(CLAVE_TOKEN, opcionesSeguras));
  const resultados = await Promise.allSettled(borrados);
  resultados.forEach((resultado) => {
    if (resultado.status === 'rejected') console.warn('No se pudo limpiar la sesión:', resultado.reason?.message);
  });

  // 4) Tareas en segundo plano que no deben retrasar el cierre de sesión.
  GoogleSignin.signOut().catch(() => {});
  if (notificarServidor) desregistrarTokenPush(idUsuarioPrevio, tokenPrevio);
};

// El servidor rechazó el token (401): se limpia la sesión una sola vez y se avisa a la navegación.
export const expirarSesion = async (tokenRechazado) => {
  if (cerrandoPorExpiracion) return;
  if (!tokenRechazado || tokenEnMemoria !== tokenRechazado) return; // ya hubo un nuevo inicio de sesión
  cerrandoPorExpiracion = true;
  await cerrarSesion({ notificarServidor: false });
  notificar(oyentesExpiracion, 'expiración de sesión');
};

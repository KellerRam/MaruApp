import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, Platform } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { alCerrarSesion, conLimite, obtenerToken } from './session';

// Detección de emergencia por sacudida.
//
// - Android: también en segundo plano. El acelerómetro solo entrega datos mientras el proceso siga vivo, así
//   que se mantiene con una actualización de ubicación de baja precisión que corre como servicio en primer
//   plano (notificación fija). La ubicación NO se lee, no se guarda ni se envía: la tarea no hace nada.
//   Si el usuario no concede el permiso de ubicación "siempre", funciona solo con la app abierta.
// - iOS: solo con la app abierta (no se usa ubicación ni modos de segundo plano).

// Umbral de fuerza (en g, restando la gravedad) para considerar una sacudida "muy brusca"
const UMBRAL_SACUDIDA = 2.6;
const LECTURAS_CONSECUTIVAS_REQUERIDAS = 3;
const VENTANA_LECTURAS_MS = 900;
const ENFRIAMIENTO_MS = 15000;
const INTERVALO_ACELEROMETRO_MS = 100;
const LIMITE_ALMACENAMIENTO_MS = 4000;
const LIMITE_RED_MS = 6000;

// Solo Android mantiene la detección con la app en segundo plano
export const SEGUNDO_PLANO_DISPONIBLE = Platform.OS === 'android';

const TAREA_MANTENER_ACTIVA = 'maru-vigilancia-emergencia';
const MOTIVO_EMERGENCIA = 'Agitación brusca detectada por sensor';

// Debe declararse al cargar la app (también cuando el sistema la reinicia en segundo plano).
if (SEGUNDO_PLANO_DISPONIBLE) {
  TaskManager.defineTask(TAREA_MANTENER_ACTIVA, async ({ error }) => {
    if (error) console.warn('Tarea de vigilancia de emergencia:', error.message);
    // Intencionalmente vacía: su único fin es mantener viva la app en segundo plano.
  });
}

let suscripcionAcelerometro = null;
let iniciando = false;
let generacionVigilancia = 0; // invalida un arranque en curso si se detiene o reinicia la vigilancia

const claveCache = (idUsuario) => `prefNotif_${idUsuario}_emergencia`;

// Preferencia "notificaciones de emergencia" del usuario: servidor y, si no responde, última guardada en el teléfono.
const leerPreferenciaEmergencia = async (idUsuario) => {
  try {
    const respuesta = await conLimite(
      fetch(`${API_URL}/api/notifications/ajustes/${idUsuario}`),
      LIMITE_RED_MS,
      null
    );
    if (respuesta?.ok) {
      const datos = await respuesta.json();
      const activa = datos.emergencia !== false;
      await conLimite(AsyncStorage.setItem(claveCache(idUsuario), String(activa)), LIMITE_ALMACENAMIENTO_MS);
      return activa;
    }
  } catch (error) {
    console.warn('No se pudo leer la preferencia de emergencia:', error.message);
  }
  const guardada = await conLimite(AsyncStorage.getItem(claveCache(idUsuario)), LIMITE_ALMACENAMIENTO_MS);
  return guardada !== 'false';
};

const obtenerIdGrupo = async (idUsuario) => {
  const guardado = await conLimite(AsyncStorage.getItem('groupId'), LIMITE_ALMACENAMIENTO_MS);
  if (guardado) return guardado;
  try {
    const respuesta = await conLimite(fetch(`${API_URL}/api/groups/user/${idUsuario}`), LIMITE_RED_MS, null);
    if (!respuesta?.ok) return null;
    const datos = await respuesta.json();
    return datos.grupo?.id_grupo ? String(datos.grupo.id_grupo) : null;
  } catch {
    return null;
  }
};

const avisarResultado = (titulo, mensaje) => {
  if (AppState.currentState === 'active') {
    Alert.alert(titulo, mensaje);
  } else {
    Notifications.scheduleNotificationAsync({ content: { title: titulo, body: mensaje }, trigger: null }).catch(() => {});
  }
};

// Misma lógica de siempre: avisa al grupo y lo registra en el chat.
const dispararEmergenciaPorAgitacion = async () => {
  try {
    if (!(await obtenerToken())) return;
    const idUsuario = await conLimite(AsyncStorage.getItem('userId'), LIMITE_ALMACENAMIENTO_MS);
    if (!idUsuario) return;
    const idGrupo = await obtenerIdGrupo(idUsuario);
    if (!idGrupo) return;

    const respuesta = await fetch(`${API_URL}/api/emergency/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_grupo: idGrupo, id_usuario: idUsuario, motivo: MOTIVO_EMERGENCIA }),
    });
    if (!respuesta.ok) throw new Error('El servidor no pudo registrar la emergencia');

    avisarResultado('¡Alerta de Emergencia!', 'Se ha detectado un movimiento brusco. Se ha notificado al grupo y cuidadores.');
  } catch (error) {
    console.error('Error al disparar emergencia automática:', error);
  }
};

// Detección de sacudida muy brusca: requiere varias lecturas consecutivas por encima del umbral
// para evitar falsos positivos con movimientos normales.
const iniciarAcelerometro = () => {
  if (suscripcionAcelerometro) return;
  let ultimaActualizacion = 0;
  let lecturasRecientes = [];
  let ultimoDisparo = 0;

  Accelerometer.setUpdateInterval(INTERVALO_ACELEROMETRO_MS);
  suscripcionAcelerometro = Accelerometer.addListener(({ x, y, z }) => {
    const ahora = Date.now();
    if (ahora - ultimaActualizacion < 90) return;
    ultimaActualizacion = ahora;

    const magnitud = Math.sqrt(x * x + y * y + z * z);
    const fuerzaNeta = Math.abs(magnitud - 1); // resta la gravedad (~1g en reposo)

    lecturasRecientes = lecturasRecientes.filter((t) => ahora - t < VENTANA_LECTURAS_MS);
    if (fuerzaNeta > UMBRAL_SACUDIDA) lecturasRecientes.push(ahora);

    if (lecturasRecientes.length >= LECTURAS_CONSECUTIVAS_REQUERIDAS && ahora - ultimoDisparo > ENFRIAMIENTO_MS) {
      ultimoDisparo = ahora;
      lecturasRecientes = [];
      dispararEmergenciaPorAgitacion();
    }
  });
};

const detenerAcelerometro = () => {
  if (suscripcionAcelerometro) {
    suscripcionAcelerometro.remove();
    suscripcionAcelerometro = null;
  }
};

const permisoUbicacionSiempre = async () => {
  if (!SEGUNDO_PLANO_DISPONIBLE) return false;
  const primerPlano = await Location.getForegroundPermissionsAsync();
  if (primerPlano.status !== 'granted') return false;
  const segundoPlano = await Location.getBackgroundPermissionsAsync();
  return segundoPlano.status === 'granted';
};

const iniciarMantenerActiva = async () => {
  if (!SEGUNDO_PLANO_DISPONIBLE) return false;
  try {
    if (!(await permisoUbicacionSiempre())) return false;
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_MANTENER_ACTIVA)) return true;
    await Location.startLocationUpdatesAsync(TAREA_MANTENER_ACTIVA, {
      accuracy: Location.Accuracy.Lowest,
      distanceInterval: 1000,
      timeInterval: 60000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Other,
      foregroundService: {
        notificationTitle: 'Detección de emergencia activa',
        notificationBody: 'Sacude bruscamente el teléfono para avisar a tu grupo.',
        notificationColor: '#60A5A3',
      },
    });
    return true;
  } catch (error) {
    console.warn('No se pudo activar la vigilancia en segundo plano:', error.message);
    return false;
  }
};

const detenerMantenerActiva = async () => {
  if (!SEGUNDO_PLANO_DISPONIBLE) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_MANTENER_ACTIVA)) {
      await Location.stopLocationUpdatesAsync(TAREA_MANTENER_ACTIVA);
    }
  } catch {
    // Si la tarea no estaba registrada no hay nada que detener.
  }
};

// Pide al usuario los permisos de ubicación (primer plano y "siempre") necesarios para el segundo plano (solo Android).
export const solicitarPermisosEmergencia = async () => {
  if (!SEGUNDO_PLANO_DISPONIBLE) return false;
  try {
    const primerPlano = await Location.requestForegroundPermissionsAsync();
    if (primerPlano.status !== 'granted') return false;
    const segundoPlano = await Location.requestBackgroundPermissionsAsync();
    return segundoPlano.status === 'granted';
  } catch (error) {
    console.warn('No se pudieron solicitar los permisos de emergencia:', error.message);
    return false;
  }
};

export const detenerVigilanciaEmergencia = async () => {
  generacionVigilancia += 1;
  detenerAcelerometro();
  await detenerMantenerActiva();
};

// Arranca la detección si hay sesión y el usuario tiene activadas las notificaciones de emergencia.
export const iniciarVigilanciaEmergencia = async () => {
  if (Platform.OS === 'web' || iniciando) return;
  iniciando = true;
  const generacion = generacionVigilancia;
  try {
    if (!(await obtenerToken())) return;
    const idUsuario = await conLimite(AsyncStorage.getItem('userId'), LIMITE_ALMACENAMIENTO_MS);
    if (!idUsuario) return;

    const activada = await leerPreferenciaEmergencia(idUsuario);
    if (generacion !== generacionVigilancia) return; // se cerró sesión o se reinició mientras se leía
    if (!activada) {
      await detenerVigilanciaEmergencia();
      return;
    }

    iniciarAcelerometro();
    await iniciarMantenerActiva();
  } catch (error) {
    console.warn('No se pudo iniciar la vigilancia de emergencia:', error.message);
  } finally {
    iniciando = false;
  }
};

// Aplica un cambio de preferencia o de permisos de inmediato.
export const reiniciarVigilanciaEmergencia = async () => {
  await detenerVigilanciaEmergencia();
  iniciando = false;
  await iniciarVigilanciaEmergencia();
};

// Al cerrar sesión se deja de vigilar (y de mostrar la notificación fija en Android).
alCerrarSesion(() => {
  detenerVigilanciaEmergencia();
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { alCerrarSesion, conLimite, obtenerToken } from './session';

// Registro de notificaciones push para Android e iOS. Cada paso tiene tiempo límite o captura sus
// errores: nunca bloquea el inicio de sesión ni deja la app esperando.
const CANAL_ANDROID = 'emergencias-canal';
const LIMITE_TOKEN_EXPO_MS = 15000;

// Cómo se muestran las notificaciones cuando la app está abierta (mismo comportamiento que ya tenía la app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Evita el bucle de registros: getExpoPushTokenAsync dispara el listener de token en iOS, y el listener
// volvía a registrar. Ahora solo se registra una vez a la vez y solo si el token cambió.
let registroEnCurso = null;
let ultimoTokenRegistrado = null;
alCerrarSesion(() => { ultimoTokenRegistrado = null; });

const registrarEnServidor = async (pushToken) => {
  const sesionActiva = await obtenerToken();
  if (!sesionActiva) return; // sin sesión no hay a quién asociar el dispositivo
  const idUsuario = await conLimite(AsyncStorage.getItem('userId'), 4000);
  if (!idUsuario) return;
  const respuesta = await fetch(`${API_URL}/api/notifications/push-token/${idUsuario}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ push_token: pushToken }),
  });
  if (!respuesta.ok) throw new Error('El servidor rechazó el token push');
};

// Canal (Android), permisos, token de Expo y registro en el servidor.
export const registrarNotificacionesPush = (opciones = {}) => {
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (registroEnCurso) return registroEnCurso;
  registroEnCurso = ejecutarRegistro(opciones).finally(() => { registroEnCurso = null; });
  return registroEnCurso;
};

const ejecutarRegistro = async ({ solicitarPermiso = true } = {}) => {
  try {
    if (!Device.isDevice) return null; // los simuladores no reciben push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
        name: 'Alertas de Emergencia y Bienestar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && solicitarPermiso) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn('No hay projectId de EAS configurado: no se puede obtener el token de push de Expo.');
      return null;
    }
    const respuestaToken = await conLimite(Notifications.getExpoPushTokenAsync({ projectId }), LIMITE_TOKEN_EXPO_MS);
    const pushToken = respuestaToken?.data;
    if (!pushToken) {
      console.warn('No se obtuvo el token push (sin respuesta de Expo/APNs a tiempo).');
      return null;
    }
    if (pushToken === ultimoTokenRegistrado) return pushToken;
    await registrarEnServidor(pushToken);
    ultimoTokenRegistrado = pushToken;
    return pushToken;
  } catch (error) {
    console.warn('No se pudo registrar el token push:', error.message);
    return null;
  }
};

// Se invoca al iniciar sesión, al registrarse y al restaurar la sesión guardada.
export const activarNotificacionesDeSesion = () => registrarNotificacionesPush({ solicitarPermiso: true });

// Si el sistema rota el token push, se vuelve a registrar (solo con sesión activa).
export const iniciarNotificaciones = () => {
  if (Platform.OS === 'web') return () => {};
  const suscripcion = Notifications.addPushTokenListener(async (evento) => {
    if (registroEnCurso) return;
    const nuevo = evento?.data;
    if (!nuevo || nuevo === ultimoTokenRegistrado) return;
    if (await obtenerToken()) registrarNotificacionesPush({ solicitarPermiso: false });
  });
  return () => suscripcion.remove();
};

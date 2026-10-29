import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { obtenerToken } from './session';

const CANAL_ANDROID = 'emergencias-canal';
const CLAVE_ES_PACIENTE = 'esPaciente';
// Tipos de notificación que solo puede ver un usuario con rol "Paciente".
const TIPOS_SOLO_PACIENTE = ['bienestar'];

export const esPacienteLocal = async () => {
  try {
    return (await AsyncStorage.getItem(CLAVE_ES_PACIENTE)) === 'true';
  } catch {
    return false;
  }
};

// Consulta al servidor si el usuario es Paciente y lo guarda para filtrar notificaciones en el dispositivo.
export const sincronizarRolUsuario = async () => {
  try {
    const idUsuario = await AsyncStorage.getItem('userId');
    if (!idUsuario) return false;
    const respuesta = await fetch(`${API_URL}/api/notifications/role/${idUsuario}`);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const { es_paciente: esPaciente } = await respuesta.json();
    await AsyncStorage.setItem(CLAVE_ES_PACIENTE, esPaciente ? 'true' : 'false');
    return Boolean(esPaciente);
  } catch (error) {
    console.warn('No se pudo sincronizar el rol del usuario:', error.message);
    return esPacienteLocal();
  }
};

// Primer plano: las alertas de bienestar solo se muestran si el usuario es Paciente.
Notifications.setNotificationHandler({
  handleNotification: async (notificacion) => {
    const tipo = notificacion.request.content.data?.tipo;
    const permitida = !TIPOS_SOLO_PACIENTE.includes(tipo) || (await esPacienteLocal());
    return {
      shouldShowBanner: permitida,
      shouldShowList: permitida,
      shouldPlaySound: permitida,
      shouldSetBadge: permitida,
    };
  },
});

const configurarCanalAndroid = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
    name: 'Alertas de Emergencia y Bienestar',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'default',
  });
};

const enviarTokenAlServidor = async (token) => {
  const idUsuario = await AsyncStorage.getItem('userId');
  if (!idUsuario || !token) return;
  const respuesta = await fetch(`${API_URL}/api/notifications/push-token/${idUsuario}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ push_token: token }),
  });
  if (!respuesta.ok) throw new Error('El servidor rechazó el token push');
};

// Canal (Android), permisos, token de Expo y registro en el servidor. Funciona en Android e iOS.
export const registrarNotificacionesPush = async ({ solicitarPermiso = false } = {}) => {
  if (Platform.OS === 'web') return null;
  try {
    if (!Device.isDevice) {
      console.warn('Las notificaciones push requieren un dispositivo físico.');
      return null;
    }
    await configurarCanalAndroid();

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
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await enviarTokenAlServidor(token);
    return token;
  } catch (error) {
    console.warn('No se pudo registrar el token push:', error.message);
    return null;
  }
};

// Se invoca tras iniciar sesión o restaurarla: sincroniza rol y registra el dispositivo.
export const activarNotificacionesDeSesion = async ({ solicitarPermiso = false } = {}) => {
  await sincronizarRolUsuario();
  await registrarNotificacionesPush({ solicitarPermiso });
};

const confirmarDesdeNotificacion = async (data) => {
  if (!data?.tipo || !data?.clave_ocurrencia) return;
  try {
    if (TIPOS_SOLO_PACIENTE.includes(data.tipo) && !(await esPacienteLocal())) return;
    const idUsuario = await AsyncStorage.getItem('userId');
    if (!idUsuario) return;
    const respuesta = await fetch(`${API_URL}/api/notifications/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: data.tipo, id_usuario: idUsuario, clave_ocurrencia: data.clave_ocurrencia }),
    });
    if (!respuesta.ok) throw new Error('No se pudo confirmar la alerta');
  } catch (error) {
    console.error('Error al confirmar alerta:', error);
  }
};

// Listeners globales (se montan una vez desde el layout raíz): toque de notificación,
// rotación del token push y actualización del rol al volver a primer plano.
export const iniciarNotificaciones = () => {
  const respuestaSub = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    confirmarDesdeNotificacion(respuesta.notification.request.content.data);
  });
  const tokenSub = Notifications.addPushTokenListener(async () => {
    if (await obtenerToken()) registrarNotificacionesPush({ solicitarPermiso: false });
  });
  const estadoSub = AppState.addEventListener('change', async (estado) => {
    if (estado === 'active' && (await obtenerToken())) sincronizarRolUsuario();
  });
  return () => {
    respuestaSub.remove();
    tokenSub.remove();
    estadoSub.remove();
  };
};

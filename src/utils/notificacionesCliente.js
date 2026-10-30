import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { iniciarVigilanciaEmergencia } from './emergenciaSegundoPlano';
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
export const activarNotificacionesDeSesion = () => {
  iniciarVigilanciaEmergencia(); // la detección de sacudida arranca con la sesión
  return registrarNotificacionesPush({ solicitarPermiso: true });
};

// ---------------------------------------------------------------------------
// Respuesta a las notificaciones de bienestar y medicamentos
// - Bienestar: con tocar la notificación (o su botón) el paciente confirma que está bien.
// - Medicamento: el botón "Confirmar toma" confirma; al tocar la notificación se pide confirmar.
// ---------------------------------------------------------------------------
const ACCION_CONFIRMAR = 'confirmar';
const CLAVE_ULTIMA_RESPUESTA = 'ultimaRespuestaNotificacion';

const registrarCategorias = async () => {
  try {
    await Notifications.setNotificationCategoryAsync('bienestar', [
      { identifier: ACCION_CONFIRMAR, buttonTitle: 'Estoy bien', options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync('medicamento', [
      { identifier: ACCION_CONFIRMAR, buttonTitle: 'Confirmar toma', options: { opensAppToForeground: true } },
    ]);
  } catch (error) {
    console.warn('No se pudieron registrar las acciones de notificación:', error.message);
  }
};

const confirmarEnServidor = async (tipo, claveOcurrencia) => {
  try {
    if (!(await obtenerToken())) return { ok: false };
    const idUsuario = await conLimite(AsyncStorage.getItem('userId'), 4000);
    if (!idUsuario) return { ok: false };
    const respuesta = await fetch(`${API_URL}/api/notifications/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id_usuario: idUsuario, clave_ocurrencia: claveOcurrencia }),
    });
    if (!respuesta.ok) return { ok: false };
    const datos = await respuesta.json().catch(() => ({}));
    return { ok: true, yaConfirmada: Boolean(datos.yaConfirmada) };
  } catch (error) {
    console.warn('No se pudo confirmar la alerta:', error.message);
    return { ok: false };
  }
};

const confirmarBienestar = async (clave) => {
  const resultado = await confirmarEnServidor('bienestar', clave);
  if (!resultado.ok) {
    Alert.alert('No se pudo confirmar', 'Revisa tu conexión e intenta tocar la notificación de nuevo.');
  } else if (resultado.yaConfirmada) {
    Alert.alert('Bienestar confirmado', 'Esta alerta ya estaba confirmada.');
  } else {
    Alert.alert('Bienestar confirmado', 'Se avisó al grupo que estás bien.');
  }
};

const confirmarToma = async (clave) => {
  const resultado = await confirmarEnServidor('medicamento', clave);
  if (resultado.ok) Alert.alert('Toma confirmada', 'Se dejará de recordar esta toma al grupo.');
  else Alert.alert('No se pudo confirmar', 'Revisa tu conexión e intenta de nuevo.');
};

const atenderRespuestaNotificacion = async (respuesta) => {
  try {
    const contenido = respuesta?.notification?.request?.content;
    const datos = contenido?.data;
    if (!datos?.tipo || !datos?.clave_ocurrencia) return;

    const accion = respuesta.actionIdentifier;
    if (accion !== Notifications.DEFAULT_ACTION_IDENTIFIER && accion !== ACCION_CONFIRMAR) return;

    // Una misma respuesta (p. ej. la que abrió la app) no se procesa dos veces
    const idRespuesta = `${respuesta.notification.request.identifier}:${accion}`;
    if ((await conLimite(AsyncStorage.getItem(CLAVE_ULTIMA_RESPUESTA), 4000)) === idRespuesta) return;
    await conLimite(AsyncStorage.setItem(CLAVE_ULTIMA_RESPUESTA, idRespuesta), 4000);

    if (datos.tipo === 'bienestar') {
      await confirmarBienestar(datos.clave_ocurrencia);
    } else if (datos.tipo === 'medicamento') {
      if (accion === ACCION_CONFIRMAR) {
        await confirmarToma(datos.clave_ocurrencia);
      } else {
        Alert.alert('Recordatorio de medicamento', contenido?.body || '¿Ya se tomó el medicamento?', [
          { text: 'Más tarde', style: 'cancel' },
          { text: 'Confirmar toma', onPress: () => confirmarToma(datos.clave_ocurrencia) },
        ]);
      }
    }
  } catch (error) {
    console.warn('No se pudo atender la notificación:', error.message);
  }
};

// Mantiene registrado el token push del dispositivo (rotación del token) y atiende los toques sobre
// las notificaciones mientras haya sesión.
export const iniciarNotificaciones = () => {
  if (Platform.OS === 'web') return () => {};
  registrarCategorias();

  const suscripcionToken = Notifications.addPushTokenListener(async (evento) => {
    if (registroEnCurso) return;
    const nuevo = evento?.data;
    if (!nuevo || nuevo === ultimoTokenRegistrado) return;
    if (await obtenerToken()) registrarNotificacionesPush({ solicitarPermiso: false });
  });

  const suscripcionRespuestas = Notifications.addNotificationResponseReceivedListener(atenderRespuestaNotificacion);
  // Notificación que abrió la app estando cerrada
  Notifications.getLastNotificationResponseAsync?.().then((respuesta) => {
    if (respuesta) atenderRespuestaNotificacion(respuesta);
  }).catch(() => {});

  return () => {
    suscripcionToken.remove();
    suscripcionRespuestas.remove();
  };
};

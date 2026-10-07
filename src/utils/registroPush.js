import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

// Debe definirse al cargar la app para que las notificaciones en primer plano se muestren.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Registra el token de push del dispositivo para el usuario con sesión; es seguro llamarlo varias veces.
export const registrarDispositivoPush = async () => {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const idUsuario = await AsyncStorage.getItem('userId');
    if (!idUsuario) return;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn('No hay projectId de EAS configurado: no se puede obtener el token de push.');
      return;
    }

    // En Android 13+ el canal debe existir antes de pedir el permiso.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('emergencias-canal', {
        name: 'Alertas de Emergencia y Bienestar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const respuesta = await fetch(`${API_URL}/api/notifications/push-token/${idUsuario}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ push_token: token }),
    });
    if (!respuesta.ok) throw new Error('El servidor rechazó el token push');
  } catch (error) {
    console.warn('No se pudo registrar el token push:', error.message);
  }
};

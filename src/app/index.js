import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { registrarDispositivoPush } from '../utils/registroPush';

export default function Index() {
  const router = useRouter();

  // useFocusEffect: la pantalla sigue montada en el drawer y debe restaurar la sesión cada vez que se vuelve a '/'.
  useFocusEffect(useCallback(() => {
    let activo = true;

    // La sesión vive en AsyncStorage: si hay token, se entra directo en lugar de pedir login.
    const restaurarSesion = async () => {
      let destino = '/login';
      try {
        const [token, idUsuario] = await Promise.all([
          AsyncStorage.getItem('userToken'),
          AsyncStorage.getItem('userId'),
        ]);
        if (token && idUsuario) {
          destino = '/(tabs)';
          registrarDispositivoPush();
          try {
            const respuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
            if (respuesta.status === 401) destino = '/login';
            else if (respuesta.ok) destino = (await respuesta.json()).tieneGrupo ? '/(tabs)' : '/group-selection';
          } catch {
            // Sin conexión se conserva la sesión y se abre la app.
          }
        }
      } catch (error) {
        console.warn('No se pudo restaurar la sesión:', error.message);
      }
      if (activo) router.replace(destino);
    };

    restaurarSesion();
    return () => { activo = false; };
  }, [router]));

  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color="#60A5A3" />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
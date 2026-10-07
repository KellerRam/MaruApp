import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
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
  }, [router]);

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
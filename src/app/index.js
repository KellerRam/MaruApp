import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { activarNotificacionesDeSesion } from '../utils/notificacionesCliente';
import { cargarSesionGuardada } from '../utils/session';

export default function Index() {
  const router = useRouter();

  // Restaura la sesión guardada y redirige una sola vez. La lectura tiene tiempo límite: la pantalla
  // de carga nunca se queda esperando indefinidamente.
  useEffect(() => {
    let cancelado = false;

    const restaurarSesion = async () => {
      let destino = '/login';
      try {
        const sesion = await cargarSesionGuardada();
        if (sesion) {
          destino = sesion.tieneGrupo ? '/(tabs)' : '/group-selection';
          activarNotificacionesDeSesion();
        }
      } catch (error) {
        console.warn('No se pudo restaurar la sesión:', error.message);
      }
      if (!cancelado) router.replace(destino);
    };

    restaurarSesion();
    return () => {
      cancelado = true;
    };
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

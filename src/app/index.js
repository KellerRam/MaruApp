import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { activarNotificacionesDeSesion } from '../utils/notificacionesCliente';
import { obtenerIdGrupoActivo, obtenerSesion } from '../utils/session';

export default function Index() {
  const router = useRouter();

  // Restaura la sesión persistida y redirige una sola vez según su estado.
  useEffect(() => {
    let cancelado = false;

    const restaurarSesion = async () => {
      let destino = '/login';
      try {
        const sesion = await obtenerSesion();
        if (sesion) {
          destino = sesion.tieneGrupo ? '/(tabs)' : '/group-selection';
          activarNotificacionesDeSesion({ solicitarPermiso: false });
          // Deja listo el grupo para el chat y el calendario sin bloquear la navegación.
          // Confirma en segundo plano que el usuario sigue en un grupo (pudo salir desde otro dispositivo).
          if (sesion.tieneGrupo) {
            obtenerIdGrupoActivo({ forzar: true }).then((idGrupo) => {
              if (idGrupo === null) router.replace('/group-selection');
            });
          }
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

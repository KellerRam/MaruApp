import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { conTiempoLimite, leerSesionMultiple } from '../utils/almacenSesion';
import { estadoNotificacionInicial, registrarDispositivoPush } from '../utils/registroPush';

export default function Index() {
  const router = useRouter();
  const enCursoRef = useRef(false);

  // useFocusEffect: restaura la sesión de forma controlada cada vez que la pantalla gana foco
  useFocusEffect(
    useCallback(() => {
      let activo = true;

      const restaurarSesion = async () => {
        // Prevenir ejecuciones concurrentes o bucles en el hilo JS
        if (enCursoRef.current) return;
        enCursoRef.current = true;

        let destino = '/login';

        try {
          // Lectura robusta de almacenamiento: si falla o agota tiempo, devuelve null
          const { userToken: token, userId: idUsuario } = await leerSesionMultiple(['userToken', 'userId']);

          if (token && idUsuario) {
            destino = '/(tabs)';
            
            try {
              registrarDispositivoPush();
            } catch {
              // Registro push silencioso sin interrumpir el flujo
            }

            // Comprobación de grupo con tiempo límite estricto (3s) para evitar carga infinita en iOS
            try {
              const peticionGrupo = fetch(`${API_URL}/api/groups/user/${idUsuario}`);
              const respuesta = await conTiempoLimite(peticionGrupo, 3000, 'verificar grupo');
              if (respuesta?.status === 401) {
                destino = '/login';
              } else if (respuesta?.ok) {
                const datos = await respuesta.json();
                destino = datos?.tieneGrupo ? '/(tabs)' : '/group-selection';
              }
            } catch {
              // Sin conexión o timeout: conserva la sesión activa y entra directo a las pestañas principales
              destino = '/(tabs)';
            }
          } else {
            // Sin token o idUsuario -> ruta directa y única al login sin reintentos
            destino = '/login';
          }
        } catch (error) {
          console.warn('Fallo al restaurar sesión inicial:', error?.message || error);
          destino = '/login';
        }

        if (!activo) {
          enCursoRef.current = false;
          return;
        }

        // Manejo de notificación inicial para abrir chat con transiciones desacopladas en iOS
        if (estadoNotificacionInicial.abrirChat && destino !== '/login') {
          estadoNotificacionInicial.abrirChat = false;
          setTimeout(() => {
            if (activo) {
              router.replace('/(tabs)');
              setTimeout(() => {
                if (activo) {
                  router.push('/ChatScreen');
                  enCursoRef.current = false;
                }
              }, 150);
            }
          }, 50);
          return;
        }

        // Redirección segura fuera de la fase de render para prevenir excepciones silenciosas en iOS
        setTimeout(() => {
          if (activo) {
            router.replace(destino);
            enCursoRef.current = false;
          }
        }, 50);
      };

      restaurarSesion();

      return () => {
        activo = false;
        enCursoRef.current = false;
      };
    }, [router])
  );

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
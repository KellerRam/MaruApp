import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { conTiempoLimite, leerSesion, leerSesionMultiple } from '../utils/almacenSesion';
import { estadoNotificacionInicial, registrarDispositivoPush } from '../utils/registroPush';
import { alCerrarSesion, cerrarSesion } from '../utils/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const RUTAS_PUBLICAS = ['/', '/login', '/signup', '/forgot-password', '/join'];

function ContenidoMenuLateral(props) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const cargarUsuario = async () => {
      // No realizar peticiones si se está en rutas públicas o la sesión no está activa
      if (RUTAS_PUBLICAS.includes(pathname) || cancelado) {
        setUsuario(null);
        return;
      }

      try {
        const idUsuario = await leerSesion('userId');
        if (!idUsuario || cancelado) {
          if (!cancelado) setUsuario(null);
          return;
        }

        const respuesta = await conTiempoLimite(fetch(`${API_URL}/api/auth/user/${idUsuario}`), 3000, 'perfil menú');
        if (respuesta && respuesta.ok) {
          const datos = await respuesta.json();
          if (!cancelado) setUsuario(datos.usuario);
        } else if (!cancelado) {
          setUsuario(null);
        }
      } catch (error) {
        // Sin bucles de reintento: ante fallo se mantiene null para no bloquear el hilo de JSC/Hermes en iOS
        if (!cancelado) setUsuario(null);
        console.warn('Error al cargar el perfil en el menú:', error?.message || error);
      }
    };

    cargarUsuario();

    return () => {
      cancelado = true;
    };
  }, [pathname]);

  useEffect(() => alCerrarSesion(() => setUsuario(null)), []);

  const nombreUsuario = usuario?.nombre_usuario || 'Cargando perfil...';
  const inicialAvatar = nombreUsuario.charAt(0).toUpperCase();

  return (
    <View style={estilosMenu.contenedor}>
      <View style={estilosMenu.cabeceraPerfil}>
        <View style={[estilosMenu.avatarCirculo, { backgroundColor: '#A8D8D0' }]}>
          <Text style={estilosMenu.textoAvatar}>{inicialAvatar}</Text>
        </View>
        <View style={estilosMenu.infoUsuario}>
          <Text style={estilosMenu.nombreUsuario}>{nombreUsuario}</Text>
          <TouchableOpacity 
            style={estilos.enlacePerfil} 
            onPress={() => {
              props.navigation.closeDrawer();
              router.push('/UserProfileScreen');
            }}
          >  
            <Text style={estilosMenu.textoVerPerfil}>Ver perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={estilosMenu.cuerpoMenu}>
        <TouchableOpacity 
          style={estilosMenu.opcionItem} 
          onPress={() => {
            props.navigation.closeDrawer();
            router.push('/NotificationSettingsScreen');
          }}
        >
          <Feather name="bell" size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoOpcion}>Gestionar notificaciones</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={estilosMenu.opcionItem} 
          onPress={() => {
            props.navigation.closeDrawer();
            router.push('/SymptomHistoryScreen');
          }}
        >
          <MaterialIcons name="fact-check" size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoOpcion}>Historial de síntomas</Text>
        </TouchableOpacity>
      </View>

      <View style={estilosMenu.pieMenu}>
        <TouchableOpacity onPress={async () => {
          props.navigation.closeDrawer();
          await cerrarSesion();
          router.replace('/login');
        }}>
          <Text style={estilosMenu.textoCerrarSesion}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  // 1. Hidratación inicial asíncrona con control estricto de timeout
  useEffect(() => {
    let activo = true;

    // Respaldo de seguridad para que la UI nunca quede en blanco o colgada indefinidamente
    const respaldo = setTimeout(() => {
      if (activo) {
        setIsReady(true);
      }
    }, 4000);

    (async () => {
      try {
        await leerSesionMultiple(['userToken', 'userId', 'groupId']);
        if (Platform.OS !== 'web') {
          if (Platform.OS === 'android') {
            await conTiempoLimite(Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
              sound: 'default',
            }), 3000, 'canal de notificaciones');
          }
          const ultima = await conTiempoLimite(Notifications.getLastNotificationResponseAsync(), 3000, 'ultima notificación');
          if (ultima?.notification?.request?.content?.data?.tipo === 'chat') {
            estadoNotificacionInicial.abrirChat = true;
          }
        }
      } catch (error) {
        console.warn('No se pudo hidratar la sesión inicial:', error?.message || error);
      } finally {
        clearTimeout(respaldo);
        if (activo) {
          setIsReady(true);
        }
      }
    })();

    return () => {
      activo = false;
      clearTimeout(respaldo);
    };
  }, []);

  // 2. Ocultar el Splash Screen únicamente cuando los componentes nativos de iOS hayan completado su montaje
  useEffect(() => {
    if (!isReady) return;
    const temporizadorSplash = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
    return () => clearTimeout(temporizadorSplash);
  }, [isReady]);

  // 3. Suscripción a notificaciones push una vez que el layout está listo
  useEffect(() => {
    if (Platform.OS === 'web' || !isReady) return undefined;

    const tokenListener = Notifications.addPushTokenListener(() => { registrarDispositivoPush(); });
    const respuestaListener = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      if (respuesta?.notification?.request?.content?.data?.tipo === 'chat') router.push('/ChatScreen');
    });

    return () => {
      tokenListener.remove();
      respuestaListener.remove();
    };
  }, [router, isReady]);

  // 4. Protección de rutas protegidas: ejecuta la redirección de forma asíncrona fuera de la fase de render
  useEffect(() => {
    if (!isReady || RUTAS_PUBLICAS.includes(pathname)) return undefined;
    let activo = true;

    leerSesionMultiple(['userToken', 'userId'])
      .then((sesion) => {
        if (activo && (!sesion?.userToken || !sesion?.userId)) {
          setTimeout(() => {
            if (activo) router.replace('/login');
          }, 0);
        }
      })
      .catch(() => {
        if (activo) {
          setTimeout(() => {
            if (activo) router.replace('/login');
          }, 0);
        }
      });

    return () => { activo = false; };
  }, [isReady, pathname, router]);

  // 5. Manejo del botón atrás en Android
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/') return false;
      router.replace('/');
      return true;
    });

    return () => subscription.remove();
  }, [pathname, router]);

  // Renderizado inicial controlado: evita null para que el árbol nativo de iOS se monte correctamente
  if (!isReady) {
    return (
      <View style={estilos.contenedorCargaGlobal}>
        <ActivityIndicator size="large" color="#60A5A3" />
      </View>
    );
  }

  return (
    <Drawer
      initialRouteName="index"
      drawerContent={(props) => <ContenidoMenuLateral {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Inicio' }} />
      <Drawer.Screen name="SymptomHistoryScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="UserProfileScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="NotificationSettingsScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="ChatScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="login" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      <Drawer.Screen name="signup" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      <Drawer.Screen name="forgot-password" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      <Drawer.Screen name="group-selection" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      <Drawer.Screen name="join" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
    </Drawer>
  );
}

const estilosMenu = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  cabeceraPerfil: { flexDirection: 'row', alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  avatarCirculo: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  textoAvatar: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  infoUsuario: { justifyContent: 'center' },
  nombreUsuario: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  textoVerPerfil: { fontSize: 12, color: '#777777', marginTop: 2 },
  cuerpoMenu: { flex: 1, paddingTop: 30 },
  opcionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  iconoOpcion: { marginRight: 16 },
  textoOpcion: { fontSize: 14, color: '#222222', fontWeight: '500' },
  pieMenu: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 20, alignItems: 'flex-start' },
  textoCerrarSesion: { fontSize: 14, color: '#3B7A8C', fontWeight: '600', textDecorationLine: 'underline' },
});

const estilos = StyleSheet.create({
  enlacePerfil: { marginTop: 2 },
  contenedorCargaGlobal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
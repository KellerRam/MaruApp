import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { registrarDispositivoPush } from '../utils/registroPush';
import { alCerrarSesion, cerrarSesion } from '../utils/session';

function ContenidoMenuLateral(props) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let temporizadorReintento = null;

    const cargarUsuario = async (intento = 0) => {
      try {
        const idUsuario = await AsyncStorage.getItem('userId');
        if (!idUsuario || cancelado) return;
        const respuesta = await fetch(`${API_URL}/api/auth/user/${idUsuario}`);
        if (respuesta.ok) {
          const datos = await respuesta.json();
          if (!cancelado) setUsuario(datos.usuario);
        }
      } catch (error) {
        // Reintenta una vez: el backend puede tardar en aceptar conexiones al iniciar
        if (intento < 1 && !cancelado) {
          temporizadorReintento = setTimeout(() => cargarUsuario(intento + 1), 1500);
          return;
        }
        console.error('Error al cargar el perfil en el menú:', error);
      }
    };

    cargarUsuario();
    return () => {
      cancelado = true;
      if (temporizadorReintento) clearTimeout(temporizadorReintento);
    };
  }, [pathname]); // Se recarga cada vez que cambias de pantalla o abres el menú

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

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    // Si el sistema rota el token de push, se vuelve a registrar en el servidor.
    const tokenListener = Notifications.addPushTokenListener(() => { registrarDispositivoPush(); });
    const respuestaListener = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      if (respuesta.notification.request.content.data?.tipo === 'chat') router.push('/ChatScreen');
    });

    return () => {
      tokenListener.remove();
      respuestaListener.remove();
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/') return false;
      router.replace('/');
      return true;
    });

    return () => subscription.remove();
  }, [pathname, router]);

  return (
    <Drawer
      drawerContent={(props) => <ContenidoMenuLateral {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Inicio' }} />
      <Drawer.Screen name="SymptomHistoryScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="UserProfileScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="NotificationSettingsScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="ChatScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
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
  enlacePerfil: { marginTop: 2 }
});
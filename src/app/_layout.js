import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';

function ContenidoMenuLateral(props) {
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const cargarUsuario = async () => {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) return;
      const respuesta = await fetch(`${API_URL}/api/auth/user/${idUsuario}`);
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setUsuario(datos.usuario);
      }
    };

    cargarUsuario().catch((error) => console.error('Error al cargar el perfil:', error));
  }, []);

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
          <TouchableOpacity style={estilosMenu.infousuario} href="/UserProfileScreen">  
          <Feather size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoVerPerfil}>Ver perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={estilosMenu.cuerpoMenu}>
        <TouchableOpacity style={estilosMenu.opcionItem} href="/NotificationSettingsScreen">
          <Feather name="bell" size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoOpcion}>Gestionar notificaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={estilosMenu.opcionItem}>
          <MaterialIcons name="fact-check" size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoOpcion}>Historial de síntomas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={estilosMenu.opcionItem}>
          <Feather name="file-text" size={20} color="#333" style={estilosMenu.iconoOpcion} />
          <Text style={estilosMenu.textoOpcion}>Permisos de la aplicación</Text>
        </TouchableOpacity>
      </View>

      <View style={estilosMenu.pieMenu}>
        <TouchableOpacity>
          <Text style={estilosMenu.textoCerrarSesion}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Drawer
      drawerContent={(props) => <ContenidoMenuLateral {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Inicio' }} />
      <Drawer.Screen name="ChatScreen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="login" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      <Drawer.Screen name="signup" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
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
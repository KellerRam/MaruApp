import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { API_URL } from '../../config/api';

export default function PantallaGrupo() {
  const [miembros, setMiembros] = useState([]);
  const [idGrupo, setIdGrupo] = useState(null);
  const [idUsuarioActivo, setIdUsuarioActivo] = useState(null);
  const [miembroParaRol, setMiembroParaRol] = useState(null);
  const [invitacion, setInvitacion] = useState(null);

  useEffect(() => {
    const cargarMiembros = async () => {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) return;
      setIdUsuarioActivo(Number(idUsuario));

      const grupoRespuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
      if (!grupoRespuesta.ok) return;
      const grupoDatos = await grupoRespuesta.json();
      const idGrupo = grupoDatos.grupo?.id_grupo?.toString();
      if (!idGrupo) return;
      await AsyncStorage.setItem('groupId', idGrupo);
      setIdGrupo(idGrupo);

      const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/members`);
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setMiembros(datos.miembros || []);
      }
    };

    cargarMiembros().catch((error) => console.error('Error al cargar miembros:', error));
  }, []);

  const cambiarRol = (id, nombre) => {
    setMiembroParaRol({ id, nombre });
  };

  const generarInvitacion = async () => {
    try {
      const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario: idUsuarioActivo }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        Alert.alert('No se pudo generar la invitación', datos.error || 'Intenta nuevamente');
        return;
      }
      const enlace = typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/join?token=${encodeURIComponent(datos.token)}`
        : `appmaru://join?token=${encodeURIComponent(datos.token)}`;
      setInvitacion(enlace);
    } catch (error) {
      Alert.alert('Error de conexión', 'No se pudo generar la invitación');
    }
  };

  const copiarInvitacion = async () => {
    await Clipboard.setStringAsync(invitacion);
    Alert.alert('Enlace copiado', 'Puedes compartirlo con el nuevo miembro');
  };

  const actualizarRol = async (idUsuario, nuevoRol) => {
    if (!idGrupo) return;
    try {
      const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/members/${idUsuario}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: nuevoRol }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        Alert.alert('No se pudo asignar el rol', datos.error || 'Intenta nuevamente');
        return;
      }
      setMiembros((prev) => prev.map((miembro) => (
        miembro.id_usuario === idUsuario ? { ...miembro, rol: nuevoRol } : miembro
      )));
      setMiembroParaRol(null);
    } catch (error) {
      Alert.alert('Error de conexión', 'No se pudo actualizar el rol');
    }
  };

  const eliminarMiembro = (idUsuario, nombre) => {
    Alert.alert(
      'Eliminar miembro',
      `¿Deseas eliminar a ${nombre} de este grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/members/${idUsuario}`, {
                method: 'DELETE',
              });
              const datos = await respuesta.json();
              if (!respuesta.ok) {
                Alert.alert('No se pudo eliminar', datos.error || 'Intenta nuevamente');
                return;
              }
              setMiembros((prev) => prev.filter((miembro) => miembro.id_usuario !== idUsuario));
            } catch (error) {
              Alert.alert('Error de conexión', 'No se pudo eliminar al miembro');
            }
          },
        },
      ]
    );
  };

  const renderizarMiembro = ({ item }) => (
    <View style={estilos.tarjetaMiembro}>
      
      <View style={[estilos.avatar, { backgroundColor: '#A8D8D0' }]} />
      
      <View style={estilos.contenedorNombre}>
        <Text 
          style={estilos.textoNombre} 
          numberOfLines={1} 
          ellipsizeMode="tail"
        >
          {item.nombre}
        </Text>
      </View>

      <View style={estilos.pildoraRol}>
        <Text style={estilos.textoRol}>{item.rol}</Text>
      </View>

      <TouchableOpacity
        style={[estilos.botonEliminar, item.id_usuario === idUsuarioActivo && estilos.botonDeshabilitado]}
        onPress={() => eliminarMiembro(item.id_usuario, item.nombre)}
        disabled={item.id_usuario === idUsuarioActivo}
      >
        <Feather name="trash-2" size={14} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={estilos.botonAjustes}
        onPress={() => cambiarRol(item.id_usuario, item.nombre)}
      >
        <MaterialIcons name="more-vert" size={24} color="#555" />
      </TouchableOpacity>

    </View>
  );

  return (
    <SafeAreaView style={estilos.contenedor}>

      <View style={estilos.seccionTitulo}>
        <Text style={estilos.tituloPrincipal}>Miembros Actuales</Text>
        <TouchableOpacity onPress={generarInvitacion}>
          <Text style={estilos.enlaceAgregar}>+ agregar miembro</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={miembros}
        keyExtractor={(item) => item.id_usuario.toString()}
        renderItem={renderizarMiembro}
        contentContainerStyle={estilos.listaContenedor}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={Boolean(miembroParaRol)}
        transparent
        animationType="fade"
        onRequestClose={() => setMiembroParaRol(null)}
      >
        <View style={estilos.fondoModal}>
          <View style={estilos.modalRol}>
            <Text style={estilos.tituloModal}>Asignar rol</Text>
            <Text style={estilos.nombreModal}>{miembroParaRol?.nombre}</Text>
            <TouchableOpacity style={estilos.opcionModal} onPress={() => actualizarRol(miembroParaRol.id, 'paciente')}>
              <Text style={estilos.textoOpcionModal}>Paciente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilos.opcionModal} onPress={() => actualizarRol(miembroParaRol.id, 'cuidador')}>
              <Text style={estilos.textoOpcionModal}>Cuidador</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilos.cancelarModal} onPress={() => setMiembroParaRol(null)}>
              <Text style={estilos.textoCancelarModal}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(invitacion)}
        transparent
        animationType="fade"
        onRequestClose={() => setInvitacion(null)}
      >
        <View style={estilos.fondoModal}>
          <View style={estilos.modalInvitacion}>
            <Text style={estilos.tituloModal}>Invitar miembro</Text>
            {invitacion ? (
              <QRCode value={invitacion} size={190} color="#000000" backgroundColor="#FFFFFF" />
            ) : null}
            <Text style={estilos.enlaceInvitacion} numberOfLines={2}>{invitacion}</Text>
            <TouchableOpacity style={estilos.opcionModal} onPress={copiarInvitacion}>
              <Text style={estilos.textoOpcionModal}>Copiar enlace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilos.cancelarModal} onPress={() => setInvitacion(null)}>
              <Text style={estilos.textoCancelarModal}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  encabezado: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  botonMenu: {
    backgroundColor: '#60A5A3',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seccionTitulo: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tituloPrincipal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  enlaceAgregar: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#3B7A8C',
    fontWeight: '600',
    textAlign: 'right',
  },
  listaContenedor: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tarjetaMiembro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  contenedorNombre: {
    flex: 1,
    paddingRight: 8,
  },
  textoNombre: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  pildoraRol: {
    borderWidth: 1,
    borderColor: '#60A5A3',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  textoRol: {
    fontSize: 12,
    color: '#60A5A3',
    fontWeight: '600',
  },
  botonEliminar: {
    backgroundColor: '#E53935',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  botonDeshabilitado: { opacity: 0.35 },
  botonAjustes: {
    padding: 4,
  },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)', justifyContent: 'center', alignItems: 'center' },
  modalRol: { width: '82%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalInvitacion: { width: '82%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center' },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  enlaceInvitacion: { color: '#666', fontSize: 12, textAlign: 'center', marginVertical: 14 },
  nombreModal: { color: '#666', marginBottom: 14 },
  opcionModal: { borderWidth: 1, borderColor: '#60A5A3', borderRadius: 10, padding: 12, marginBottom: 10, alignItems: 'center' },
  textoOpcionModal: { color: '#087A7A', fontSize: 15, fontWeight: '600' },
  cancelarModal: { padding: 10, alignItems: 'center' },
  textoCancelarModal: { color: '#666', fontSize: 14 },
});
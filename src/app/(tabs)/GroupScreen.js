import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';
import { API_URL } from '../../config/api';
import { apiFetch as fetch } from '../../config/apiFetch';
import { useSincronizacion } from '../../hooks/use-sincronizacion';

export default function PantallaGrupo() {
  const montadaRef = useRef(false);
  const [miembros, setMiembros] = useState([]);
  const [idGrupo, setIdGrupo] = useState(null);
  const [idUsuarioActivo, setIdUsuarioActivo] = useState(null);
  const [miembroParaRol, setMiembroParaRol] = useState(null);
  const [invitacion, setInvitacion] = useState(null);
  const [mostrarPacienteManual, setMostrarPacienteManual] = useState(false);
  const [nombrePaciente, setNombrePaciente] = useState('');
  const [generoPaciente, setGeneroPaciente] = useState('Otro');
  const [fechaNacimientoPaciente, setFechaNacimientoPaciente] = useState('');
  const [guardandoPaciente, setGuardandoPaciente] = useState(false);

  // Estados para el selector de fecha (DateTimePicker)
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());

  // Función reutilizable para cargar los miembros del grupo
  const cargarMiembros = async () => {
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario || !montadaRef.current) return;
      setIdUsuarioActivo(Number(idUsuario));

      const grupoRespuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
      if (!grupoRespuesta.ok || !montadaRef.current) return;
      const grupoDatos = await grupoRespuesta.json();
      const idGrp = grupoDatos.grupo?.id_grupo?.toString();
      if (!idGrp || !montadaRef.current) return;
      
      await AsyncStorage.setItem('groupId', idGrp);
      setIdGrupo(idGrp);

      const respuesta = await fetch(`${API_URL}/api/groups/${idGrp}/members`);
      if (!montadaRef.current) return;
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setMiembros(Array.isArray(datos.miembros) ? datos.miembros : []);
      } else {
        setMiembros([]);
      }
      
    } catch (error) {
      console.error('Error al cargar miembros:', error);
    }
  };

  useEffect(() => {
    montadaRef.current = true;
    cargarMiembros();
    return () => { montadaRef.current = false; };
  }, []);

  useSincronizacion(cargarMiembros);

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
      if (!montadaRef.current) return;
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

  const seleccionarTipoMiembro = () => {
    Alert.alert('Agregar miembro', 'Selecciona cómo agregarlo', [
      { text: 'Invitar por enlace', onPress: generarInvitacion },
      { text: 'Agregar paciente manualmente', onPress: () => setMostrarPacienteManual(true) },
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const onChangeFecha = (event, selectedDate) => {
    const currentDate = selectedDate || fechaSeleccionada;
    setMostrarCalendario(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaSeleccionada(currentDate);
      const anio = currentDate.getFullYear();
      const mes = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dia = String(currentDate.getDate()).padStart(2, '0');
      setFechaNacimientoPaciente(`${anio}-${mes}-${dia}`);
    }
  };

  const guardarPacienteManual = async () => {
    if (!nombrePaciente.trim() || !fechaNacimientoPaciente.trim()) {
      Alert.alert('Datos incompletos', 'Ingresa el nombre y la fecha de nacimiento del paciente.');
      return;
    }
    if (!idGrupo || !idUsuarioActivo) {
      Alert.alert('Error', 'No se pudo identificar el grupo o tu sesión.');
      return;
    }

    setGuardandoPaciente(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/patients/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: idUsuarioActivo,
          nombre: nombrePaciente,
          genero: generoPaciente,
          fechaNacimiento: fechaNacimientoPaciente.trim()
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        Alert.alert('No se pudo agregar', datos.error || 'Intenta nuevamente');
        return;
      }

      setMostrarPacienteManual(false);
      setNombrePaciente('');
      setGeneroPaciente('Otro');
      setFechaNacimientoPaciente('');
      await cargarMiembros();
    } catch (error) {
      Alert.alert('Error de conexión', 'No se pudo agregar al paciente');
    } finally {
      setGuardandoPaciente(false);
    }
  };

  const seleccionarGeneroPaciente = () => {
    Alert.alert('Género del paciente', undefined, [
      ...['Masculino', 'Femenino', 'Otro'].map((genero) => ({
        text: genero,
        onPress: () => setGeneroPaciente(genero)
      }))
    ]);
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

      const textoRespuesta = await respuesta.text();
      let datos;
      try {
        datos = JSON.parse(textoRespuesta);
      } catch (e) {
        throw new Error(`El servidor respondió con un formato inválido: ${textoRespuesta.substring(0, 100)}`);
      }

      if (!respuesta.ok) {
        Alert.alert('Aviso', datos.error || 'No se pudo asignar el rol');
        return;
      }
      
      setMiembroParaRol(null);
      await cargarMiembros();
      Alert.alert('Éxito', 'Rol actualizado correctamente');
    } catch (error) {
      console.error('Error detallado:', error);
      Alert.alert('Error', error.message);
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
        <TouchableOpacity onPress={seleccionarTipoMiembro}>
          <Text style={estilos.enlaceAgregar}>+ agregar miembro</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={Array.isArray(miembros) ? miembros.filter(m => m && m.id_usuario != null) : []}
        keyExtractor={(item, index) => (item?.id_usuario ? String(item.id_usuario) : `miembro-${index}`)}
        renderItem={renderizarMiembro}
        contentContainerStyle={estilos.listaContenedor}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>
            No hay miembros registrados en este grupo.
          </Text>
        }
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

      <Modal
        visible={mostrarPacienteManual}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarPacienteManual(false)}
      >
        <KeyboardAvoidingView style={estilos.fondoModal} behavior="padding">
          <View style={estilos.modalInvitacion}>
            <Text style={estilos.tituloModal}>Agregar paciente</Text>
            <Text style={estilos.enlaceInvitacion}>Este perfil no requiere correo ni acceso desde un celular.</Text>
            <TextInput
              style={estilos.entradaPaciente}
              placeholder="Nombre completo"
              placeholderTextColor="#48d9d9"
              value={nombrePaciente}
              onChangeText={setNombrePaciente}
              maxLength={100}
            />
            <TouchableOpacity style={estilos.opcionModal} onPress={seleccionarGeneroPaciente}>
              <Text style={estilos.textoOpcionModal}>Género: {generoPaciente}</Text>
            </TouchableOpacity>

            {/* Selector de fecha por calendario */}
            <TouchableOpacity 
              style={estilos.opcionModal} 
              onPress={() => setMostrarCalendario(true)}
            >
              <Text style={estilos.textoOpcionModal}>
                {fechaNacimientoPaciente ? `Fecha: ${fechaNacimientoPaciente}` : 'Seleccionar fecha de nacimiento'}
              </Text>
            </TouchableOpacity>

            {mostrarCalendario && (
              <DateTimePicker
                value={fechaSeleccionada}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={onChangeFecha}
              />
            )}

            <TouchableOpacity
              style={estilos.opcionModal}
              onPress={guardarPacienteManual}
              disabled={guardandoPaciente}
            >
              <Text style={estilos.textoOpcionModal}>{guardandoPaciente ? 'Guardando...' : 'Agregar paciente'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilos.cancelarModal} onPress={() => setMostrarPacienteManual(false)}>
              <Text style={estilos.textoCancelarModal}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  seccionTitulo: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 20,
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
  entradaPaciente: { alignSelf: 'stretch', borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 10, padding: 12, marginBottom: 10 },
  nombreModal: { color: '#666', marginBottom: 14 },
  opcionModal: { borderWidth: 1, borderColor: '#60A5A3', borderRadius: 10, padding: 12, marginBottom: 10, alignItems: 'center', alignSelf: 'stretch' },
  textoOpcionModal: { color: '#087A7A', fontSize: 15, fontWeight: '600' },
  cancelarModal: { padding: 10, alignItems: 'center' },
  textoCancelarModal: { color: '#666', fontSize: 14 },
});
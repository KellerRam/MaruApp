// src/app/SymptomHistoryScreen.js
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormPickerInput from '../components/ui/FormPickerInput';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const horaSinSegundos = (hora) => String(hora || '').slice(0, 5);

export default function SymptomHistoryScreen() {
  const router = useRouter();
  const [sintomas, setSintomas] = useState([]);
  const [sintomasFiltrados, setSintomasFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para el Modal de Edición
  const [modalVisible, setModalVisible] = useState(false);
  const [sintomaEditando, setSintomaEditando] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [descEdit, setDescEdit] = useState('');
  const [fechaEdit, setFechaEdit] = useState('');
  const [horaEdit, setHoraEdit] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarHistorial = async (estaActiva = () => true) => {
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!estaActiva()) return;
      if (!idUsuario) {
        router.replace('/login');
        return;
      }

      const respuesta = await fetch(`${API_URL}/api/symptoms/${idUsuario}`);
      if (!respuesta.ok) throw new Error('No se pudo cargar el historial de síntomas');

      const datos = await respuesta.json();
      if (!estaActiva()) return;
      setSintomas(datos.sintomas || []);
      setSintomasFiltrados(datos.sintomas || []);
    } catch (error) {
      if (estaActiva()) setErrorMsg(error.message);
    } finally {
      if (estaActiva()) setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    cargarHistorial(() => activo);
    return () => { activo = false; };
  }, [router]);

  const aplicarFiltro = (tipo) => {
    setFiltroActivo(tipo);
    const ahora = new Date();

    if (tipo === 'todos') {
      setSintomasFiltrados(sintomas);
    } else if (tipo === 'semana') {
      const inicioSemana = new Date();
      inicioSemana.setDate(ahora.getDate() - 7);
      const filtrados = sintomas.filter((s) => {
        const fechaSintoma = new Date(s.fecha_sintoma);
        return fechaSintoma >= inicioSemana && fechaSintoma <= ahora;
      });
      setSintomasFiltrados(filtrados);
    } else if (tipo === 'mes') {
      const mesActual = ahora.getMonth() + 1;
      const anioActual = ahora.getFullYear();
      const filtrados = sintomas.filter((s) => {
        const partes = String(s.fecha_sintoma).split('T')[0].split('-');
        return Number(partes[0]) === anioActual && Number(partes[1]) === mesActual;
      });
      setSintomasFiltrados(filtrados);
    }
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]} de ${NOMBRES_MESES[Number(partes[1]) - 1]} de ${partes[0]}`;
  };

  const abrirEditar = (item) => {
    setSintomaEditando(item);
    setNombreEdit(item.nombre_sintoma);
    setDescEdit(item.descripcion);
    setFechaEdit(String(item.fecha_sintoma).split('T')[0]);
    setHoraEdit(horaSinSegundos(item.hora_sintoma));
    setModalVisible(true);
  };

  const guardarEdicion = async () => {
    if (!nombreEdit.trim() || !descEdit.trim() || !fechaEdit || !horaEdit) {
      Alert.alert('Campos incompletos', 'Por favor llena todos los campos.');
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/symptoms/${sintomaEditando.id_sintoma}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_sintoma: nombreEdit,
          descripcion: descEdit,
          fecha_sintoma: fechaEdit,
          hora_sintoma: horaEdit,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo actualizar');

      Alert.alert('Actualizado', 'El síntoma se modificó correctamente.');
      setModalVisible(false);
      cargarHistorial();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (idSintoma) => {
    Alert.alert('Eliminar', '¿Deseas eliminar este registro de síntoma?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const respuesta = await fetch(`${API_URL}/api/symptoms/${idSintoma}`, {
              method: 'DELETE',
            });
            if (!respuesta.ok) throw new Error('No se pudo eliminar el registro');
            Alert.alert('Eliminado', 'El síntoma fue borrado.');
            cargarHistorial();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const renderItemSintoma = ({ item }) => (
    <View style={estilos.tarjetaSintoma}>
      <View style={estilos.cabeceraTarjeta}>
        <Text style={estilos.nombreSintoma}>{item.nombre_sintoma}</Text>
        <View style={estilos.accionesTarjeta}>
          <TouchableOpacity onPress={() => abrirEditar(item)} style={{ marginRight: 10 }}>
            <Feather name="edit-2" size={16} color="#0A3D4C" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmarEliminar(item.id_sintoma)}>
            <Feather name="trash-2" size={16} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={estilos.badgeHora}>
        <Feather name="clock" size={12} color="#0A3D4C" style={{ marginRight: 4 }} />
        <Text style={estilos.textoHora}>{horaSinSegundos(item.hora_sintoma)}</Text>
      </View>
      
      <Text style={estilos.descripcionSintoma}>{item.descripcion}</Text>
      
      <View style={estilos.pieTarjeta}>
        <Feather name="calendar" size={13} color="#666" style={{ marginRight: 6 }} />
        <Text style={estilos.fechaSintoma}>{formatearFechaVisual(item.fecha_sintoma)}</Text>
      </View>
    </View>
  );

  if (cargando) {
    return (
      <View style={estilos.contenedorCargando}>
        <ActivityIndicator size="large" color="#60A5A3" />
        <Text style={estilos.textoCargando}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor}>
      <View style={estilos.encabezado}>
        <TouchableOpacity style={estilos.botonCerrar} onPress={() => router.push('/(tabs)')}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
        <Text style={estilos.tituloPrincipal}>Historial de Síntomas</Text>
      </View>

      <View style={estilos.contenedorFiltros}>
        <TouchableOpacity style={[estilos.btnFiltro, filtroActivo === 'todos' && estilos.btnFiltroActivo]} onPress={() => aplicarFiltro('todos')}>
          <Text style={[estilos.txtFiltro, filtroActivo === 'todos' && estilos.txtFiltroActivo]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[estilos.btnFiltro, filtroActivo === 'semana' && estilos.btnFiltroActivo]} onPress={() => aplicarFiltro('semana')}>
          <Text style={[estilos.txtFiltro, filtroActivo === 'semana' && estilos.txtFiltroActivo]}>Esta semana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[estilos.btnFiltro, filtroActivo === 'mes' && estilos.btnFiltroActivo]} onPress={() => aplicarFiltro('mes')}>
          <Text style={[estilos.txtFiltro, filtroActivo === 'mes' && estilos.txtFiltroActivo]}>Este mes</Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? <Text style={estilos.mensajeError}>{errorMsg}</Text> : null}

      {sintomasFiltrados.length === 0 ? (
        <View style={estilos.contenedorVacio}>
          <Feather name="clipboard" size={48} color="#A8D8D0" style={{ marginBottom: 12 }} />
          <Text style={estilos.textoVacio}>No hay registros de síntomas para este filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={sintomasFiltrados}
          keyExtractor={(item) => String(item.id_sintoma)}
          renderItem={renderItemSintoma}
          contentContainerStyle={estilos.listaContenedor}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal para Editar Síntoma */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={estilos.fondoModal}>
          <View style={estilos.modalContenido}>
            <Text style={estilos.tituloModal}>Editar Síntoma</Text>
            <TextInput style={estilos.input} placeholder="Síntoma" placeholderTextColor="#48d9d9" value={nombreEdit} onChangeText={setNombreEdit} />
            <TextInput style={[estilos.input, estilos.inputDesc]} placeholder="Descripción" placeholderTextColor="#48d9d9" value={descEdit} onChangeText={setDescEdit} multiline />
            
            <FormPickerInput
              pickerType="date"
              modalTitle="Fecha del síntoma"
              style={estilos.input}
              placeholder="Fecha (AAAA-MM-DD)"
              value={fechaEdit}
              onChangeText={setFechaEdit}
            />
            <FormPickerInput
              pickerType="time"
              modalTitle="Hora del síntoma"
              style={estilos.input}
              placeholder="Hora (HH:MM)"
              value={horaEdit}
              onChangeText={setHoraEdit}
            />

            <TouchableOpacity style={estilos.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar Cambios'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilos.botonCancelar} onPress={() => setModalVisible(false)}>
              <Text style={estilos.textoBotonCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 20 },
  contenedorCargando: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  textoCargando: { marginTop: 10, fontSize: 14, color: '#666' },
  encabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  botonCerrar: { padding: 4, marginRight: 12 },
  tituloPrincipal: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  contenedorFiltros: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#F0F5F5', borderRadius: 12, padding: 4 },
  btnFiltro: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  btnFiltroActivo: { backgroundColor: '#60A5A3', elevation: 2 },
  txtFiltro: { fontSize: 13, fontWeight: '600', color: '#555' },
  txtFiltroActivo: { color: '#FFF' },
  listaContenedor: { paddingBottom: 40 },
  tarjetaSintoma: { backgroundColor: '#C8E8E2', borderRadius: 16, padding: 16, marginBottom: 14 },
  cabeceraTarjeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nombreSintoma: { fontSize: 16, fontWeight: 'bold', color: '#000', flex: 1 },
  accionesTarjeta: { flexDirection: 'row', alignItems: 'center' },
  badgeHora: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#A8D8D0', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, marginBottom: 8 },
  textoHora: { fontSize: 12, fontWeight: 'bold', color: '#0A3D4C' },
  descripcionSintoma: { fontSize: 14, color: '#333', marginBottom: 12, lineHeight: 20 },
  pieTarjeta: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#A8D8D0', paddingTop: 8 },
  fechaSintoma: { fontSize: 12, color: '#555', fontWeight: '500' },
  mensajeError: { color: '#D32F2F', textAlign: 'center', marginBottom: 12 },
  contenedorVacio: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  textoVacio: { fontSize: 14, color: '#888', textAlign: 'center' },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContenido: { width: '85%', backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  tituloModal: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#111' },
  input: { borderWidth: 1, borderColor: '#A8D8D0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: '#222' },
  inputDesc: { minHeight: 60, textAlignVertical: 'top' },
  botonGuardar: { backgroundColor: '#008B8B', borderRadius: 18, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  textoBotonGuardar: { color: '#FFF', fontWeight: 'bold' },
  botonCancelar: { paddingVertical: 10, alignItems: 'center' },
  textoBotonCancelar: { color: '#666' },
});
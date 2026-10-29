// src/app/manage-operations.js
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FormPickerInput from '../components/ui/FormPickerInput';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { useSincronizacion } from '../hooks/use-sincronizacion';

export default function ManageOperationsScreen() {
  const montadaRef = useRef(false);
  const ahora = new Date();
  const fechaHoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  const horaActualStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  const [tipoAccion, setTipoAccion] = useState(null); // 'agregar', 'editar', 'borrar'
  const [tipoEntidad, setTipoEntidad] = useState('medicamento'); // 'medicamento', 'cuidado', 'evento'

  // Listas de datos cargados
  const [cuidadoresDisponibles, setCuidadoresDisponibles] = useState([]);
  const [elementosLista, setElementosLista] = useState([]);
  const [idSeleccionado, setIdSeleccionado] = useState(null);

  // Formulario Medicamento
  const [nombreMed, setNombreMed] = useState('');
  const [dosis, setDosis] = useState('');
  const [presentacion, setPresentacion] = useState('');

  // Formulario Horario Cuidado (Máximo 3 cuidadores seleccionados)
  const [cuidadoresSeleccionados, setCuidadoresSeleccionados] = useState([]);
  const [horaInicioCuidado, setHoraInicioCuidado] = useState('');
  const [horaFinCuidado, setHoraFinCuidado] = useState('');

  // Formulario Evento
  const [nombreEvento, setNombreEvento] = useState('');
  const [horaEvento, setHoraEvento] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');

  useEffect(() => {
    montadaRef.current = true;
    cargarCuidadoresGrupo();
    return () => { montadaRef.current = false; };
  }, []);

  useSincronizacion(() => cargarCuidadoresGrupo());

  const cargarCuidadoresGrupo = async () => {
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      const idGrupoGuardado = await AsyncStorage.getItem('groupId');
      if (!montadaRef.current) return;
      let idGrupo = idGrupoGuardado;
      if (!idGrupo && idUsuario) {
        const grupoRespuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
        if (!montadaRef.current) return;
        if (!grupoRespuesta.ok) throw new Error('No se pudo cargar el grupo');
        const grupoDatos = await grupoRespuesta.json();
        if (!montadaRef.current) return;
        idGrupo = grupoDatos.grupo?.id_grupo?.toString();
      }
      if (!idGrupo) return;

      const respuesta = await fetch(`${API_URL}/api/groups/${idGrupo}/members`);
      if (!montadaRef.current) return;
      if (respuesta.ok) {
        const datos = await respuesta.json();
        if (montadaRef.current) setCuidadoresDisponibles(datos.miembros || []);
      }
    } catch (error) {
      console.error('Error al cargar cuidadores:', error);
    }
  };

  const seleccionarCuidadorMaximoTres = (id) => {
    if (cuidadoresSeleccionados.includes(id)) {
      setCuidadoresSeleccionados(cuidadoresSeleccionados.filter(item => item !== id));
    } else {
      if (cuidadoresSeleccionados.length >= 3) {
        alert('Solo puedes seleccionar un máximo de tres cuidadores.');
        return;
      }
      setCuidadoresSeleccionados([...cuidadoresSeleccionados, id]);
    }
  };

  const cargarDatosParaModificar = async (entidad) => {
    setTipoEntidad(entidad);
    try {
      const idGrupo = await AsyncStorage.getItem('groupId');
      if (!idGrupo) return;

      const respuesta = await fetch(`${API_URL}/api/schedules/${idGrupo}`);
      if (!montadaRef.current) return;
      const datos = await respuesta.json();
      if (respuesta.ok && montadaRef.current) {
        if (entidad === 'medicamento') setElementosLista(datos.medicamentos || []);
        if (entidad === 'cuidado') setElementosLista(datos.horariosCuidado || []);
        if (entidad === 'evento') setElementosLista(datos.eventosProximos || []);
      }
    } catch (error) {
      alert('Error al cargar datos');
    }
  };

  const ejecutarAccionPrincipal = async () => {
    alert(`Acción ${tipoAccion} realizada con éxito para ${tipoEntidad}`);
    setTipoAccion(null);
  };

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Panel de Operaciones</Text>

      {/* Botones principales estilo barra de acciones (+, Editar, Borrar) */}
      <View style={estilos.barraAcciones}>
        <TouchableOpacity style={[estilos.btnAccion, tipoAccion === 'agregar' && estilos.btnActivo]} onPress={() => setTipoAccion('agregar')}>
          <Feather name="plus" size={22} color="#FFF" />
          <Text style={estilos.txtAccion}>Agregar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[estilos.btnAccion, tipoAccion === 'editar' && estilos.btnActivo]} onPress={() => { setTipoAccion('editar'); cargarDatosParaModificar('medicamento'); }}>
          <Feather name="edit" size={22} color="#FFF" />
          <Text style={estilos.txtAccion}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[estilos.btnAccion, tipoAccion === 'borrar' && estilos.btnActivo]} onPress={() => { setTipoAccion('borrar'); cargarDatosParaModificar('medicamento'); }}>
          <Feather name="trash-2" size={22} color="#FFF" />
          <Text style={estilos.txtAccion}>Borrar</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Entidad (Medicamento, Cuidado, Evento) */}
      {tipoAccion && (
        <View style={estilos.selectorEntidad}>
          {['medicamento', 'cuidado', 'evento'].map((ent) => (
            <TouchableOpacity 
              key={ent} 
              style={[estilos.pillEntidad, tipoEntidad === ent && estilos.pillActiva]} 
              onPress={() => {
                setTipoEntidad(ent);
                if (tipoAccion !== 'agregar') cargarDatosParaModificar(ent);
              }}
            >
              <Text style={[estilos.txtPill, tipoEntidad === ent && estilos.txtPillActiva]}>
                {ent.charAt(0).toUpperCase() + ent.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* FORMULARIO DE AGREGAR */}
      {tipoAccion === 'agregar' && (
        <View style={estilos.formulario}>
          <Text style={estilos.subtitulo}>Nuevo {tipoEntidad}</Text>
          
          {tipoEntidad === 'medicamento' && (
            <>
              <TextInput style={estilos.input} placeholder="Nombre del medicamento" placeholderTextColor="#48d9d9" value={nombreMed} onChangeText={setNombreMed} />
              <TextInput style={estilos.input} placeholder="Dosis (Ej. 500mg)" placeholderTextColor="#48d9d9" value={dosis} onChangeText={setDosis} />
              <TextInput style={estilos.input} placeholder="Presentación (Ej. Pastillas)" placeholderTextColor="#48d9d9" value={presentacion} onChangeText={setPresentacion} />
            </>
          )}

          {tipoEntidad === 'cuidado' && (
            <>
              <Text style={estilos.labelLista}>Selecciona hasta 3 cuidadores:</Text>
              {cuidadoresDisponibles.map((c) => (
                <TouchableOpacity key={c.id_usuario} style={estilos.filaCheckbox} onPress={() => seleccionarCuidadorMaximoTres(c.id_usuario)}>
                  <View style={[estilos.checkbox, cuidadoresSeleccionados.includes(c.id_usuario) && estilos.checkboxSeleccionado]} />
                  <Text>{c.nombre}</Text>
                </TouchableOpacity>
              ))}
              <FormPickerInput
                pickerType="time"
                modalTitle="Hora de inicio"
                style={estilos.input}
                placeholder="Hora inicio (HH:MM)"
                placeholderTextColor="#48d9d9"
                value={horaInicioCuidado}
                onChangeText={setHoraInicioCuidado}
                minTime={tipoAccion === 'agregar' ? horaActualStr : null}
              />
              <FormPickerInput
                pickerType="time"
                modalTitle="Hora de fin"
                style={estilos.input}
                placeholder="Hora fin (HH:MM)"
                placeholderTextColor="#48d9d9"
                value={horaFinCuidado}
                onChangeText={setHoraFinCuidado}
              />
            </>
          )}

          {tipoEntidad === 'evento' && (
            <>
              <TextInput style={estilos.input} placeholder="Nombre del evento" placeholderTextColor="#48d9d9" value={nombreEvento} onChangeText={setNombreEvento} />
              <FormPickerInput
                pickerType="time"
                modalTitle="Hora del evento"
                style={estilos.input}
                placeholder="Hora (HH:MM)"
                placeholderTextColor="#48d9d9"
                value={horaEvento}
                onChangeText={setHoraEvento}
              />
              <FormPickerInput
                pickerType="date"
                modalTitle="Fecha del evento"
                style={estilos.input}
                placeholder="Fecha (YYYY-MM-DD)"
                placeholderTextColor="#48d9d9"
                value={fechaEvento}
                onChangeText={setFechaEvento}
                minDate={tipoAccion === 'agregar' ? fechaHoyISO : null}
              />
            </>
          )}

          <TouchableOpacity style={estilos.btnGuardar} onPress={ejecutarAccionPrincipal}>
            <Text style={estilos.txtBtnGuardar}>Guardar Nuevo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FORMULARIO DE EDITAR O BORRAR */}
      {(tipoAccion === 'editar' || tipoAccion === 'borrar') && (
        <View style={estilos.formulario}>
          <Text style={estilos.subtitulo}>Selecciona el elemento a {tipoAccion}</Text>
          {elementosLista.map((item, idx) => {
            const idItem = item.id_medicamento || item.id_horario_cuidado || item.id_evento || idx;
            const nombreItem = item.nombre_medicamento || item.encargado || item.nombre_evento || 'Elemento';
            const seleccionado = idSeleccionado === idItem;

            return (
              <TouchableOpacity key={idItem} style={[estilos.itemSeleccionable, seleccionado && estilos.itemSeleccionado]} onPress={() => setIdSeleccionado(idItem)}>
                <Text style={[estilos.txtItem, seleccionado && estilos.txtItemSeleccionado]}>{nombreItem}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[estilos.btnGuardar, { backgroundColor: tipoAccion === 'borrar' ? '#E53935' : '#008B8B' }]} onPress={ejecutarAccionPrincipal}>
            <Text style={estilos.txtBtnGuardar}>{tipoAccion === 'borrar' ? 'Eliminar Definitivamente' : 'Guardar Cambios'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  titulo: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  barraAcciones: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  btnAccion: { backgroundColor: '#888', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', flexDirection: 'row', gap: 6 },
  btnActivo: { backgroundColor: '#60A5A3' },
  txtAccion: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  selectorEntidad: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  pillEntidad: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, borderColor: '#60A5A3' },
  pillActiva: { backgroundColor: '#60A5A3' },
  txtPill: { color: '#60A5A3', fontWeight: '600' },
  txtPillActiva: { color: '#FFF' },
  formulario: { backgroundColor: '#F9FBFB', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 15, padding: 16 },
  subtitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 10, padding: 12, backgroundColor: '#FFF', marginBottom: 12, fontSize: 15 },
  labelLista: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#444' },
  filaCheckbox: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#008B8B', marginRight: 10 },
  checkboxSeleccionado: { backgroundColor: '#008B8B' },
  itemSeleccionable: { padding: 12, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, marginBottom: 8, backgroundColor: '#FFF' },
  itemSeleccionado: { borderColor: '#60A5A3', backgroundColor: '#E8F4F2' },
  txtItem: { fontSize: 14, color: '#333' },
  txtItemSeleccionado: { fontWeight: 'bold', color: '#0A3D4C' },
  btnGuardar: { backgroundColor: '#60A5A3', padding: 14, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  txtBtnGuardar: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
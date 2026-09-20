import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../../config/api';

const VACIO = { fecha: new Date().toISOString().slice(0, 10), hora: '12:00', cantidad: '', descripcion: '', comprobante: null };
const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

export default function PantallaFinanzas() {
  const [grupo, setGrupo] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(null);
  const [tipo, setTipo] = useState('gasto');
  const [formulario, setFormulario] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState('');

  const cargar = async (idGrupo) => {
    const respuesta = await fetch(`${API_URL}/api/finances/group/${idGrupo}`);
    if (!respuesta.ok) throw new Error('No se pudieron cargar los movimientos');
    setMovimientos((await respuesta.json()).movimientos || []);
  };

  useEffect(() => {
    (async () => {
      try {
        const usuario = await AsyncStorage.getItem('userId');
        const respuesta = await fetch(`${API_URL}/api/groups/user/${usuario}`);
        const datos = await respuesta.json();
        const idGrupo = datos.grupo?.id_grupo || await AsyncStorage.getItem('groupId');
        if (!idGrupo) throw new Error('No se encontró un grupo asociado');
        setGrupo(idGrupo);
        await cargar(idGrupo);
      } catch (e) { setError(e.message); } finally { setCargando(false); }
    })();
  }, []);

  const abrirNuevo = (nuevoTipo) => { setTipo(nuevoTipo); setEditando(null); setFormulario({ ...VACIO }); setError(''); setModal('formulario'); };
  const abrirEdicion = (registro) => { setTipo(registro.tipo); setEditando(registro); setFormulario({ ...registro, fecha: String(registro.fecha).slice(0, 10), hora: String(registro.hora).slice(0, 5) }); setError(''); setModal('formulario'); };
  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const elegirComprobante = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
    if (resultado.canceled) return;
    const imagen = resultado.assets[0];
    if (imagen.fileSize && imagen.fileSize > 5 * 1024 * 1024) { setError('La imagen supera el máximo permitido de 5 MB'); return; }
    cambiar('comprobante', imagen);
  };

  const guardar = async () => {
    if (!formulario.fecha || !formulario.hora || !formulario.cantidad || !formulario.descripcion.trim()) { setError('Completa todos los campos obligatorios'); return; }
    setGuardando(true); setError('');
    try {
      const datos = new FormData();
      ['fecha', 'hora', 'cantidad', 'descripcion'].forEach((campo) => datos.append(campo, String(formulario[campo])));
      datos.append('id_grupo', String(grupo));
      if (formulario.comprobante?.uri) datos.append('comprobante', formulario.comprobante.file || { uri: formulario.comprobante.uri, name: formulario.comprobante.fileName || 'comprobante.jpg', type: formulario.comprobante.mimeType || 'image/jpeg' });
      else if (editando?.comprobante) datos.append('comprobante', editando.comprobante);
      const url = editando ? `${API_URL}/api/finances/${tipo}/${editando.id}` : `${API_URL}/api/finances/${tipo}`;
      const respuesta = await fetch(url, { method: editando ? 'PUT' : 'POST', body: datos });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo guardar el registro');
      await cargar(grupo); setModal(null);
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  const filas = movimientos.filter((item) => String(item.fecha).slice(0, 7) === mes);
  const gastos = filas.filter((item) => item.tipo === 'gasto').reduce((total, item) => total + Number(item.cantidad), 0);
  const ingresos = filas.filter((item) => item.tipo === 'ingreso').reduce((total, item) => total + Number(item.cantidad), 0);
  const exportar = (formato) => Linking.openURL(`${API_URL}/api/finances/group/${grupo}/export?mes=${mes}&formato=${formato}`);

  if (cargando) return <View style={estilos.cargando}><ActivityIndicator color="#087E8B" size="large" /><Text>Cargando finanzas...</Text></View>;
  return <SafeAreaView style={estilos.contenedor}><ScrollView contentContainerStyle={estilos.contenido}>
    <Text style={estilos.eyebrow}>CONTROL DEL GRUPO</Text><Text style={estilos.titulo}>Finanzas</Text>{error && !modal ? <Text style={estilos.error}>{error}</Text> : null}
    <TouchableOpacity style={[estilos.boton, estilos.verde]} onPress={() => setModal('presupuesto')}><Text style={estilos.oscuro}>VISUALIZAR PRESUPUESTO</Text></TouchableOpacity>
    <View style={estilos.fila}><TouchableOpacity style={[estilos.mitad, estilos.morado]} onPress={() => abrirNuevo('gasto')}><Text style={estilos.claro}>REGISTRAR{`\n`}GASTO</Text></TouchableOpacity><TouchableOpacity style={[estilos.mitad, estilos.lima]} onPress={() => abrirNuevo('ingreso')}><Text style={estilos.oscuro}>REGISTRAR{`\n`}INGRESO</Text></TouchableOpacity></View>
    <TouchableOpacity style={[estilos.boton, estilos.amarillo]} onPress={() => setModal('presupuesto')}><Text style={estilos.oscuro}>EDITAR REGISTRO</Text></TouchableOpacity>
    <View style={estilos.resumen}><Text style={estilos.etiqueta}>MOVIMIENTOS DEL MES</Text><Text style={estilos.numero}>{filas.length}</Text><Text>Gastos {(gastos)}  |  Ingresos {(ingresos)}</Text></View>
    <TouchableOpacity style={[estilos.boton, estilos.verde]} onPress={() => setModal('balance')}><Text style={estilos.oscuro}>VISUALIZAR BALANCE</Text></TouchableOpacity>
  </ScrollView><Modal visible={Boolean(modal)} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={estilos.fondo}><View style={estilos.modal}>
    {modal === 'formulario' ? <Formulario tipo={tipo} formulario={formulario} cambiar={cambiar} editar={Boolean(editando)} elegirComprobante={elegirComprobante} guardar={guardar} guardando={guardando} error={error} cerrar={() => setModal(null)} /> : null}
    {modal === 'presupuesto' ? <Presupuesto filas={filas} mes={mes} setMes={setMes} abrirEdicion={abrirEdicion} exportar={exportar} cerrar={() => setModal(null)} /> : null}
    {modal === 'balance' ? <View><Text style={estilos.tituloModal}>Balance actual</Text><Text style={estilos.balance}>{dinero(gastos - ingresos)}</Text><Text style={estilos.nota}>Gastos totales menos ingresos totales del mes.</Text><TouchableOpacity style={estilos.cerrar} onPress={() => setModal(null)}><Text>CERRAR</Text></TouchableOpacity></View> : null}
  </View></View></Modal></SafeAreaView>;
}

function Formulario({ tipo, formulario, cambiar, editar, elegirComprobante, guardar, guardando, error, cerrar }) {
  return <ScrollView><Text style={estilos.tituloModal}>{editar ? 'Editar registro' : tipo === 'gasto' ? 'Registrar gasto' : 'Registrar ingreso'}</Text>{error ? <Text style={estilos.error}>{error}</Text> : null}
    <Text style={estilos.label}>Fecha *</Text><TextInput style={estilos.input} value={formulario.fecha} onChangeText={(v) => cambiar('fecha', v)} placeholder="YYYY-MM-DD" />
    <Text style={estilos.label}>Hora *</Text><TextInput style={estilos.input} value={formulario.hora} onChangeText={(v) => cambiar('hora', v)} placeholder="HH:MM" />
    <Text style={estilos.label}>Cantidad *</Text><TextInput style={estilos.input} value={String(formulario.cantidad)} onChangeText={(v) => cambiar('cantidad', v)} keyboardType="decimal-pad" placeholder="0.00" />
    <Text style={estilos.label}>Descripción *</Text><TextInput style={[estilos.input, estilos.multilinea]} value={formulario.descripcion} onChangeText={(v) => cambiar('descripcion', v)} multiline placeholder="Detalle del movimiento" />
    <TouchableOpacity style={estilos.comprobante} onPress={elegirComprobante}><Text>{formulario.comprobante ? 'Comprobante seleccionado' : 'Adjuntar comprobante (opcional)'}</Text></TouchableOpacity>{formulario.comprobante?.uri ? <Image source={{ uri: formulario.comprobante.uri }} style={estilos.preview} /> : null}
    <View style={estilos.filaModal}><TouchableOpacity style={estilos.cerrar} onPress={cerrar}><Text>CANCELAR</Text></TouchableOpacity><TouchableOpacity style={estilos.guardar} onPress={guardar} disabled={guardando}>{guardando ? <ActivityIndicator color="#FFF" /> : <Text style={estilos.claro}>GUARDAR</Text>}</TouchableOpacity></View>
  </ScrollView>;
}

function Presupuesto({ filas, mes, setMes, abrirEdicion, exportar, cerrar }) {
  return <ScrollView><Text style={estilos.tituloModal}>Presupuesto mensual</Text><TextInput style={estilos.input} value={mes} onChangeText={setMes} placeholder="YYYY-MM" /><ScrollView horizontal><View><View style={estilos.cabecera}><Text style={estilos.celda}>Fecha</Text><Text style={estilos.celda}>Tipo</Text><Text style={estilos.celda}>Cantidad</Text><Text style={estilos.descripcion}>Descripción</Text></View>{filas.map((item) => <TouchableOpacity key={`${item.tipo}-${item.id}`} style={estilos.filaTabla} onPress={() => abrirEdicion(item)}><Text style={estilos.celda}>{String(item.fecha).slice(0, 10)}</Text><Text style={estilos.celda}>{item.tipo}</Text><Text style={estilos.celda}>{dinero(item.cantidad)}</Text><Text style={estilos.descripcion}>{item.descripcion}</Text></TouchableOpacity>)}{!filas.length ? <Text style={estilos.nota}>No hay movimientos en este mes.</Text> : null}</View></ScrollView><View style={estilos.filaModal}><TouchableOpacity style={estilos.exportar} onPress={() => exportar('xls')}><Text>EXPORTAR XLS</Text></TouchableOpacity><TouchableOpacity style={estilos.exportar} onPress={() => exportar('pdf')}><Text>EXPORTAR PDF</Text></TouchableOpacity></View><TouchableOpacity style={estilos.cerrar} onPress={cerrar}><Text>CERRAR</Text></TouchableOpacity></ScrollView>;
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F7FBFA' }, contenido: { padding: 22, paddingBottom: 40 }, cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, eyebrow: { color: '#087E8B', fontWeight: '700', letterSpacing: 1.5, fontSize: 12 }, titulo: { fontSize: 34, fontWeight: '800', color: '#12343B', marginBottom: 24 }, boton: { minHeight: 54, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 }, fila: { flexDirection: 'row', gap: 12, marginBottom: 14 }, mitad: { flex: 1, minHeight: 82, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, verde: { backgroundColor: '#B9E4DC' }, morado: { backgroundColor: '#cb6ce6' }, lima: { backgroundColor: '#c1ff72' }, amarillo: { backgroundColor: '#ffde59' }, oscuro: { color: '#12343B', fontWeight: '800', textAlign: 'center' }, claro: { color: '#FFF', fontWeight: '800', textAlign: 'center' }, resumen: { backgroundColor: '#a9d6d1', borderRadius: 12, padding: 18, marginVertical: 8, gap: 8 }, etiqueta: { color: '#000000', fontSize: 12, fontWeight: '700' }, numero: { color: '#FFF', fontSize: 32, fontWeight: '800' }, fondo: { flex: 1, backgroundColor: 'rgba(18,52,59,0.55)', justifyContent: 'flex-end' }, modal: { maxHeight: '90%', backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 }, tituloModal: { color: '#12343B', fontSize: 24, fontWeight: '800', marginBottom: 16 }, label: { color: '#31545B', fontWeight: '700', marginTop: 8 }, input: { borderWidth: 1, borderColor: '#C8D8D6', borderRadius: 8, padding: 12, marginBottom: 6, minWidth: 180 }, multilinea: { minHeight: 70, textAlignVertical: 'top' }, comprobante: { backgroundColor: '#E8F4F1', borderRadius: 8, padding: 14, marginTop: 10 }, preview: { width: 80, height: 80, borderRadius: 8, marginTop: 10 }, filaModal: { flexDirection: 'row', gap: 10, marginTop: 18, justifyContent: 'flex-end' }, cerrar: { padding: 13, borderRadius: 8, backgroundColor: '#E6EFED', alignItems: 'center', marginTop: 16 }, guardar: { padding: 13, borderRadius: 8, backgroundColor: '#087E8B', minWidth: 110, alignItems: 'center', marginTop: 16 }, error: { color: '#B42318', marginBottom: 10 }, cabecera: { flexDirection: 'row', backgroundColor: '#12343B', paddingVertical: 10 }, filaTabla: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#D8E5E2', paddingVertical: 12 }, celda: { width: 92, paddingHorizontal: 8, color: '#12343B' }, descripcion: { width: 190, paddingHorizontal: 8, color: '#12343B' }, exportar: { backgroundColor: '#C7EF71', padding: 12, borderRadius: 8, marginTop: 16 }, nota: { color: '#526D72', marginTop: 12 }, balance: { color: '#087E8B', fontSize: 40, fontWeight: '800', marginVertical: 18 },
});

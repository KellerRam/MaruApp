import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioModule, RecordingPresets, createAudioPlayer, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';

const urlArchivo = (ruta) => (ruta?.startsWith('http') ? ruta : `${API_URL}${ruta}`);

export default function PantallaChat() {
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [estadoAudio, setEstadoAudio] = useState('inactivo');
  const [mensajes, setMensajes] = useState([]);
  const [idGrupo, setIdGrupo] = useState(null);
  const [idUsuario, setIdUsuario] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [audioActivo, setAudioActivo] = useState(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const iniciar = async () => {
      const usuario = await AsyncStorage.getItem('userId');
      const grupo = await AsyncStorage.getItem('groupId');
      if (!usuario || !grupo) return;
      setIdUsuario(Number(usuario));
      setIdGrupo(grupo);
      const actualizar = async () => {
        const respuesta = await fetch(`${API_URL}/api/chat/group/${grupo}/messages?idUsuario=${usuario}`);
        if (!respuesta.ok) throw new Error('No se pudieron cargar los mensajes');
        const datos = await respuesta.json();
        setMensajes(datos.mensajes || []);
      };
      await actualizar();
      const intervalo = setInterval(() => actualizar().catch(() => {}), 5000);
      return () => clearInterval(intervalo);
    };
    let limpiarCarga;
    iniciar().then((limpieza) => { limpiarCarga = limpieza; }).catch((error) => Alert.alert('No se pudo cargar el chat', error.message));
    return () => {
      limpiarCarga?.();
      audioPlayerRef.current?.remove();
    };
  }, []);

  const agregarMensajeLocal = (mensaje) => {
    setMensajes((prev) => [...prev, { ...mensaje, remitente: 'Tú', es_mio: true }]);
  };

  const enviarArchivo = async (archivo, tipo) => {
    if (!idGrupo || !idUsuario || !archivo?.uri || enviando) return;
    setEnviando(true);
    try {
      const formulario = new FormData();
      formulario.append('idUsuario', String(idUsuario));
      formulario.append('tipo', tipo);
      const nombre = archivo.name || archivo.fileName || `archivo-${Date.now()}`;
      if (Platform.OS === 'web') {
        const respuestaArchivo = await fetch(archivo.uri);
        const blob = await respuestaArchivo.blob();
        formulario.append('archivo', blob, nombre);
      } else {
        formulario.append('archivo', new File(archivo.uri));
      }
      const respuesta = await fetch(`${API_URL}/api/chat/group/${idGrupo}/messages`, { method: 'POST', body: formulario });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo enviar el archivo');
      agregarMensajeLocal(datos.mensaje);
    } catch (error) {
      Alert.alert('No se pudo enviar', error.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviarTexto = async () => {
    const texto = mensajeTexto.trim();
    if (!texto || !idGrupo || !idUsuario || enviando) return;
    setEnviando(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/chat/group/${idGrupo}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idUsuario, tipo: 'texto', texto }) });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo enviar el mensaje');
      setMensajeTexto('');
      agregarMensajeLocal(datos.mensaje);
    } catch (error) {
      Alert.alert('No se pudo enviar', error.message);
    } finally {
      setEnviando(false);
    }
  };

  const elegirGaleria = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!resultado.canceled) await enviarArchivo({ ...resultado.assets[0], type: 'image/jpeg' }, 'imagen');
  };

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!resultado.canceled) await enviarArchivo({ ...resultado.assets[0], type: 'image/jpeg' }, 'imagen');
  };

  const elegirDocumento = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!resultado.canceled) await enviarArchivo(resultado.assets[0], 'documento');
  };

  const abrirAdjuntos = () => Alert.alert('Adjuntar', 'Elige qué deseas compartir', [
    { text: 'Tomar foto', onPress: tomarFoto },
    { text: 'Galería', onPress: elegirGaleria },
    { text: 'Documento', onPress: elegirDocumento },
    { text: 'Cancelar', style: 'cancel' },
  ]);

  const comenzarAudio = async () => {
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono para grabar una nota de voz.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setEstadoAudio('grabando');
    } catch (error) {
      Alert.alert('No se pudo grabar', error.message);
      setEstadoAudio('inactivo');
    }
  };

  const terminarAudio = async () => {
    if (estadoAudio !== 'grabando') return;
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setEstadoAudio('inactivo');
      if (uri) await enviarArchivo({ uri, name: `nota-${Date.now()}.m4a`, mimeType: 'audio/m4a' }, 'audio');
    } catch (error) {
      setEstadoAudio('inactivo');
      Alert.alert('No se pudo enviar la nota de voz', error.message);
    }
  };

  const reproducirAudio = (mensaje) => {
    audioPlayerRef.current?.remove();
    const player = createAudioPlayer(urlArchivo(mensaje.archivo_url));
    audioPlayerRef.current = player;
    player.play();
    setAudioActivo(mensaje.id_mensaje);
    setTimeout(() => {
      player.remove();
      if (audioPlayerRef.current === player) {
        audioPlayerRef.current = null;
        setAudioActivo(null);
      }
    }, 120000);
  };

  const renderizarContenido = (item) => {
    if (item.tipo === 'imagen') return <Image source={{ uri: urlArchivo(item.archivo_url) }} style={estilos.imagenMensaje} />;
    if (item.tipo === 'audio') {
      return <TouchableOpacity style={estilos.botonAudio} onPress={() => reproducirAudio(item)}><Feather name={audioActivo === item.id_mensaje ? 'volume-2' : 'play'} size={18} color="#087A7A" /><Text style={estilos.textoArchivo}>{audioActivo === item.id_mensaje ? 'Reproduciendo...' : 'Nota de voz'}</Text></TouchableOpacity>;
    }
    if (item.tipo === 'documento') {
      return <TouchableOpacity style={estilos.botonAudio} onPress={() => Linking.openURL(urlArchivo(item.archivo_url))}><Feather name="file-text" size={18} color="#087A7A" /><Text style={estilos.textoArchivo} numberOfLines={1}>{item.archivo_nombre || 'Abrir documento'}</Text></TouchableOpacity>;
    }
    return <Text style={estilos.textoMensaje}>{item.texto}</Text>;
  };

  const renderizarMensaje = ({ item }) => (
    <View style={[estilos.contenedorFilaMensaje, item.es_mio ? estilos.filaMensajeDerecha : estilos.filaMensajeIzquierda]}>
      {!item.es_mio && <View style={estilos.contenedorAvatarIzquierdo}><View style={[estilos.puntoAvatar, { backgroundColor: '#60A5A3' }]} /></View>}
      <View style={[estilos.burbujaMensaje, item.es_mio ? estilos.burbujaMia : estilos.burbujaOtro]}>
        {!item.es_mio && <Text style={estilos.textoRemitente}>{item.remitente}</Text>}
        {renderizarContenido(item)}
      </View>
      {item.es_mio && <View style={estilos.contenedorAvatarDerecho}><View style={[estilos.puntoAvatar, { backgroundColor: '#60A5A3' }]} /></View>}
    </View>
  );

  const mensajesVisibles = mensajes.filter((item) => !textoBusqueda.trim() || (item.texto || item.archivo_nombre || '').toLowerCase().includes(textoBusqueda.trim().toLowerCase()));

  return (
    <SafeAreaView style={estilos.contenedorPrincipal}>
      <KeyboardAvoidingView style={estilos.contenedorTeclado} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={estilos.encabezado}>
          <View style={estilos.barraBusqueda}><Feather name="search" size={20} color="#333" style={estilos.iconoBusqueda} /><TextInput style={estilos.inputBusqueda} placeholder="Buscar..." value={textoBusqueda} onChangeText={setTextoBusqueda} /></View>
          <TouchableOpacity style={estilos.botonCerrar} onPress={() => router.push('/(tabs)')}><Feather name="x" size={24} color="#555" /></TouchableOpacity>
        </View>
        <FlatList data={mensajesVisibles} keyExtractor={(item) => String(item.id_mensaje)} renderItem={renderizarMensaje} style={estilos.listaContenedor} contentContainerStyle={estilos.listaContenidoInterior} showsVerticalScrollIndicator={false} />
        {estadoAudio === 'inactivo' ? (
          <View style={estilos.pieDePagina}>
            <TouchableOpacity style={estilos.botonIconoBlanco} onPress={abrirAdjuntos} disabled={enviando}><Feather name="paperclip" size={20} color="#777" /></TouchableOpacity>
            <TextInput style={estilos.inputMensaje} value={mensajeTexto} onChangeText={setMensajeTexto} placeholder="Escribe un mensaje..." placeholderTextColor="#DDD" editable={!enviando} />
            {mensajeTexto.trim().length > 0 ? <TouchableOpacity style={[estilos.botonIconoBlanco, estilos.botonEnviar]} onPress={enviarTexto} disabled={enviando}><Feather name="send" size={18} color="#FFF" /></TouchableOpacity> : <><TouchableOpacity style={estilos.botonIconoBlanco} onPressIn={comenzarAudio} disabled={enviando}><Feather name="mic" size={18} color="#777" /></TouchableOpacity><TouchableOpacity style={estilos.botonIconoBlanco} onPress={tomarFoto} disabled={enviando}><Feather name="camera" size={18} color="#777" /></TouchableOpacity></>}
          </View>
        ) : (
          <View style={estilos.pieDePagina}><TouchableOpacity style={estilos.botonIconoBlanco} onPressOut={terminarAudio}><Feather name="mic" size={20} color="#D32F2F" /></TouchableOpacity><View style={estilos.contenedorInfoAudio}><Text style={estilos.textoInfoAudio}>Grabando...</Text></View><TouchableOpacity style={[estilos.botonIconoBlanco, estilos.botonEnviar]} onPressOut={terminarAudio}><Feather name="send" size={18} color="#FFF" /></TouchableOpacity></View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedorPrincipal: { flex: 1, backgroundColor: '#F5F5F5' },
  contenedorTeclado: { flex: 1 },
  encabezado: { backgroundColor: '#A8D8D0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 4 },
  barraBusqueda: { flex: 1, flexDirection: 'row', backgroundColor: '#F2F2F2', borderRadius: 20, marginHorizontal: 16, height: 44, alignItems: 'center', paddingHorizontal: 12 },
  iconoBusqueda: { marginRight: 8 }, inputBusqueda: { flex: 1, height: '100%', color: '#333' }, botonCerrar: { padding: 4 }, listaContenedor: { flex: 1 }, listaContenidoInterior: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 20 },
  contenedorFilaMensaje: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, width: '100%' }, filaMensajeIzquierda: { justifyContent: 'flex-start' }, filaMensajeDerecha: { justifyContent: 'flex-end' }, contenedorAvatarIzquierdo: { width: 24, marginRight: 8, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }, contenedorAvatarDerecho: { width: 24, marginLeft: 8, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }, puntoAvatar: { width: 20, height: 20, borderRadius: 10 }, burbujaMensaje: { maxWidth: '75%', padding: 12, borderRadius: 16 }, burbujaOtro: { backgroundColor: '#EBEBEB', borderBottomLeftRadius: 4 }, burbujaMia: { backgroundColor: '#C8E8E2', borderBottomRightRadius: 4 }, textoRemitente: { fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: '#087A7A' }, textoMensaje: { fontSize: 14, color: '#333', lineHeight: 20 }, imagenMensaje: { width: 220, height: 180, borderRadius: 10 }, botonAudio: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 130 }, textoArchivo: { color: '#087A7A', fontSize: 14, fontWeight: '600', maxWidth: 190 },
  pieDePagina: { backgroundColor: '#7A7A7A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, minHeight: 64, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, inputMensaje: { flex: 1, backgroundColor: '#999999', height: 40, borderRadius: 20, paddingHorizontal: 16, marginHorizontal: 10, color: '#FFF' }, botonIconoBlanco: { backgroundColor: '#FFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 }, botonEnviar: { backgroundColor: '#008B8B' }, contenedorInfoAudio: { flex: 1, alignItems: 'center', justifyContent: 'center' }, textoInfoAudio: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});

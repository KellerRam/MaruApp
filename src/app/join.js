// src/app/join.js
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

export default function JoinGroupScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [modoEscaneo, setModoEscaneo] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const escaneandoRef = useRef(false);

  // Función para procesar y enviar el token de invitación al servidor
  const procesarTokenInvitacion = async (tokenBruto) => {
    if (!tokenBruto || !tokenBruto.trim()) {
      setErrorMsg('El token o enlace de invitación está vacío.');
      return;
    }

    try {
      setCargando(true);
      setErrorMsg('');

      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) {
        Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
        router.replace('/login');
        return;
      }

      // Extraer el token si el usuario pegó una URL completa (ej: appmaru://join?token=XYZ o http://.../join?token=XYZ)
      let tokenLimpio = tokenBruto.trim();
      if (tokenLimpio.includes('token=')) {
        const partes = tokenLimpio.split('token=');
        tokenLimpio = partes[1].split('&')[0]; // Por si hay más parámetros
      }

      const respuesta = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: decodeURIComponent(tokenLimpio),
          idUsuario: parseInt(idUsuario, 10),
        }),
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        if (datos.idGrupo) {
          await AsyncStorage.setItem('groupId', datos.idGrupo.toString());
        }
        Alert.alert('¡Éxito!', datos.mensaje || 'Te has unido al grupo correctamente.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        setErrorMsg(datos.error || 'No se pudo procesar la invitación');
      }
    } catch (error) {
      setErrorMsg('Error de conexión con el servidor');
    } finally {
      setCargando(false);
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    if (escaneandoRef.current) return;
    escaneandoRef.current = true;
    
    setModoEscaneo(false);
    procesarTokenInvitacion(data);
  };

  const abrirScanner = async () => {
    if (!permission || !permission.granted) {
      const permisoPermitido = await requestPermission();
      if (!permisoPermitido.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara para escanear el código QR.');
        return;
      }
    }
    escaneandoRef.current = false;
    setModoEscaneo(true);
  };

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecera}>
        <TouchableOpacity style={estilos.botonRegresar} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={estilos.tituloPrincipal}>Unirse a un Grupo</Text>
      </View>

      <Text style={estilos.subtitulo}>
        Escanea el código QR proporcionado por el administrador del grupo o ingresa el enlace de invitación manualmente.
      </Text>

      {errorMsg ? <Text style={estilos.mensajeError}>{errorMsg}</Text> : null}

      {/* Opción 1: Escanear QR */}
      <TouchableOpacity style={estilos.botonPrimario} onPress={abrirScanner} disabled={cargando}>
        <Feather name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={estilos.textoBotonPrimario}>Escanear código QR</Text>
      </TouchableOpacity>

      <View style={estilos.divisorContenedor}>
        <View style={estilos.lineaDivisora} />
        <Text style={estilos.textoO}>o</Text>
        <View style={estilos.lineaDivisora} />
      </View>

      {/* Opción 2: Pegar enlace o token manual */}
      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Enlace o Token de invitación</Text>
        <TextInput
          style={estilos.input}
          placeholder="Pega aquí el enlace o token..."
          placeholderTextColor="#48d9d9"
          value={tokenInput}
          onChangeText={setTokenInput}
          multiline
        />
      </View>

      <TouchableOpacity
        style={[estilos.botonSecundario, cargando && estilos.botonDeshabilitado]}
        onPress={() => procesarTokenInvitacion(tokenInput)}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#60A5A3" />
        ) : (
          <Text style={estilos.textoBotonSecundario}>Unirse con enlace</Text>
        )}
      </TouchableOpacity>

      {/* Modal de la Cámara para escanear QR */}
      <Modal visible={modoEscaneo} animationType="slide" onRequestClose={() => setModoEscaneo(false)}>
        <View style={estilos.contenedorCamara}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <View style={estilos.capaCamaraSuperposicion}>
            <Text style={estilos.textoInstruccionCamara}>Apunta al código QR dentro del recuadro</Text>
            <TouchableOpacity style={estilos.botonCerrarCamara} onPress={() => setModoEscaneo(false)}>
              <Text style={estilos.textoCerrarCamara}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  botonRegresar: { padding: 4, marginRight: 12 },
  tituloPrincipal: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  botonPrimario: {
    backgroundColor: '#60A5A3',
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  divisorContenedor: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  lineaDivisora: { flex: 1, height: 1, backgroundColor: '#DDD' },
  textoO: { marginHorizontal: 12, color: '#888', fontWeight: '600' },
  grupoInput: { marginBottom: 16 },
  etiqueta: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#FFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  botonSecundario: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#60A5A3',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonDeshabilitado: { opacity: 0.6 },
  textoBotonSecundario: { color: '#60A5A3', fontSize: 16, fontWeight: 'bold' },
  mensajeError: {
    color: '#D32F2F',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  contenedorCamara: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000' },
  capaCamaraSuperposicion: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  textoInstruccionCamara: { color: '#FFF', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  botonCerrarCamara: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  textoCerrarCamara: { color: '#111', fontSize: 15, fontWeight: 'bold' },
});
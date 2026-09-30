// src/app/create-group.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
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

export default function CreateGroupScreen() {
  const router = useRouter();
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const iniciarConfirmacion = () => {
    setErrorMsg('');
    if (!nombreGrupo.trim()) {
      setErrorMsg('Por favor, ingresa un nombre para el grupo.');
      return;
    }
    setMostrarConfirmacion(true);
  };

  const confirmarGuardado = async () => {
    setMostrarConfirmacion(false);
    setGuardando(true);
    setErrorMsg('');

    try {
      const idUsuarioLogueado = await AsyncStorage.getItem('userId');
      if (!idUsuarioLogueado) {
        alert('Sesión no encontrada. Inicia sesión nuevamente.');
        router.replace('/login');
        return;
      }

      const respuesta = await fetch(`${API_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreGrupo: nombreGrupo.trim(),
          idUsuario: parseInt(idUsuarioLogueado, 10),
        }),
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        if (datos.idGrupo) {
          await AsyncStorage.setItem('groupId', datos.idGrupo.toString());
        }
        router.replace('/(tabs)');
      } else {
        setErrorMsg(datos.error || 'Error al crear el grupo');
      }
    } catch (error) {
      setErrorMsg('No se pudo conectar con el servidor para guardar el grupo');
    } finally {
      setGuardando(false);
    }
  };

  const cancelarConfirmacion = () => {
    setMostrarConfirmacion(false);
  };

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      <Text style={estilos.titulo}>Crear Grupo de Cuidado</Text>
      <Text style={estilos.subtitulo}>
        Asigna un nombre a tu equipo para comenzar a gestionar pacientes y horarios.
      </Text>

      {errorMsg ? <Text style={estilos.mensajeError}>{errorMsg}</Text> : null}

      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Nombre del grupo</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej. Familia Pérez"
          placeholderTextColor="#999"
          value={nombreGrupo}
          onChangeText={setNombreGrupo}
        />
      </View>

      <TouchableOpacity
        style={[estilos.botonPrimario, guardando && estilos.botonDeshabilitado]}
        onPress={iniciarConfirmacion}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={estilos.textoBotonPrimario}>Crear</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={estilos.botonCancelarNavegacion}
        onPress={() => router.back()}
        disabled={guardando}
      >
        <Text style={estilos.textoBotonCancelarNavegacion}>Volver</Text>
      </TouchableOpacity>

      {/* Modal de Confirmación */}
      <Modal
        visible={mostrarConfirmacion}
        transparent
        animationType="fade"
        onRequestClose={cancelarConfirmacion}
      >
        <View style={estilos.fondoModal}>
          <View style={estilos.tarjetaModal}>
            <Text style={estilos.tituloModal}>Confirmar Creación</Text>
            <Text style={estilos.mensajeModal}>
              ¿Deseas crear el grupo "{nombreGrupo.trim()}" y guardarlo en la base de datos?
            </Text>

            <View style={estilos.filaBotonesModal}>
              <TouchableOpacity
                style={estilos.botonModalCancelar}
                onPress={cancelarConfirmacion}
              >
                <Text style={estilos.textoModalCancelar}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={estilos.botonModalAceptar}
                onPress={confirmarGuardado}
              >
                <Text style={estilos.textoModalAceptar}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 8, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  grupoInput: { marginBottom: 20 },
  etiqueta: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  botonPrimario: {
    backgroundColor: '#60A5A3',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  botonDeshabilitado: { opacity: 0.6 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  botonCancelarNavegacion: { alignItems: 'center', paddingVertical: 10 },
  textoBotonCancelarNavegacion: { color: '#666', fontSize: 15 },
  mensajeError: {
    color: '#D32F2F',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },

  // Modal
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tarjetaModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 12, textAlign: 'center' },
  mensajeModal: { fontSize: 15, color: '#444', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  filaBotonesModal: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  botonModalCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#999',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  textoModalCancelar: { color: '#666', fontSize: 15, fontWeight: '600' },
  botonModalAceptar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#60A5A3',
    alignItems: 'center',
  },
  textoModalAceptar: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});
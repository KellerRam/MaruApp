// src/app/group-selection.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function GroupSelectionScreen() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [tieneGrupo, setTieneGrupo] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Verificar en la base de datos si el usuario actual está enlazado a un grupo
  useEffect(() => {
    let activo = true;

    const verificarGrupoUsuario = async () => {
      try {
        const idUsuario = await AsyncStorage.getItem('userId');
        if (!idUsuario) {
          if (activo) router.replace('/login');
          return;
        }

        const respuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
        if (respuesta.ok) {
          const datos = await respuesta.json();
          if (datos.tieneGrupo) {
            if (activo) {
              setTieneGrupo(true);
              router.replace('/(tabs)');
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error al verificar grupo en base de datos:', error);
      } finally {
        if (activo) setCargando(false);
      }
    };

    verificarGrupoUsuario();

    return () => {
      activo = false;
    };
  }, []);

  // Al presionar el botón "Crear" del formulario, validar y abrir modal de confirmación
  const iniciarConfirmacionCrear = () => {
    setErrorMsg('');
    if (!nombreGrupo.trim()) {
      setErrorMsg('Por favor, ingresa un nombre para el grupo.');
      return;
    }
    setMostrarConfirmacion(true);
  };

  // Al presionar "Aceptar" en la confirmación, se guarda en la base de datos
  const confirmarGuardadoGrupo = async () => {
    setMostrarConfirmacion(false);
    setGuardando(true);
    setErrorMsg('');

    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) {
        alert('Sesión no encontrada. Por favor inicia sesión nuevamente.');
        router.replace('/login');
        return;
      }

      const respuesta = await fetch(`${API_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreGrupo: nombreGrupo.trim(),
          idUsuario: parseInt(idUsuario, 10),
        }),
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        // Grupo creado y vinculado exitosamente en la base de datos
        if (datos.idGrupo) {
          await AsyncStorage.setItem('groupId', datos.idGrupo.toString());
        }
        router.replace('/(tabs)');
      } else {
        setErrorMsg(datos.error || 'Error al guardar el grupo');
      }
    } catch (error) {
      setErrorMsg('No se pudo conectar con el servidor para guardar el grupo');
    } finally {
      setGuardando(false);
    }
  };

  // Al presionar "Cancelar" en la confirmación
  const cancelarConfirmacion = () => {
    setMostrarConfirmacion(false);
  };

  if (cargando) {
    return (
      <View style={estilos.contenedorCargando}>
        <ActivityIndicator size="large" color="#60A5A3" />
        <Text style={estilos.textoCargando}>Verificando vinculación a grupo...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      {/* Logo */}
      <View style={estilos.contenedorLogo}>
        <Text style={estilos.textoLogo}>LOGO</Text>
      </View>

      {!mostrarFormulario ? (
        // Opciones cuando no está enlazado a un grupo
        <View style={estilos.bloqueOpciones}>
          <Text style={estilos.titulo}>Bienvenido</Text>
          <Text style={estilos.subtitulo}>
            No estás enlazado a ningún grupo actualmente. Selecciona una opción para continuar:
          </Text>

          {/* Opción 1: Crear grupo (despliega el formulario) */}
          <TouchableOpacity
            style={estilos.botonPrimario}
            onPress={() => {
              setErrorMsg('');
              setMostrarFormulario(true);
            }}
          >
            <Text style={estilos.textoBotonPrimario}>Crear grupo</Text>
          </TouchableOpacity>

          {/* Opción 2: Unirse a grupo (sin lógica asignada de momento) */}
          <TouchableOpacity
            style={estilos.botonSecundario}
            onPress={() => {
              // De momento "unirse a grupo" no tendrá ninguna lógica asignada
            }}
            activeOpacity={0.7}
          >
            <Text style={estilos.textoBotonSecundario}>Unirse a grupo</Text>
          </TouchableOpacity>

          <Text style={estilos.notaSinLogica}>
            * La opción "Unirse a grupo" estará disponible próximamente.
          </Text>
        </View>
      ) : (
        // Formulario para creación de grupo
        <View style={estilos.bloqueFormulario}>
          <Text style={estilos.titulo}>Crear Grupo de Cuidado</Text>
          <Text style={estilos.subtitulo}>
            Asigna un nombre a tu nuevo grupo para comenzar a gestionar el equipo.
          </Text>

          {errorMsg ? <Text style={estilos.mensajeError}>{errorMsg}</Text> : null}

          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Nombre del grupo</Text>
            <TextInput
              style={estilos.input}
              placeholder="Ej. Familia Martínez"
              placeholderTextColor="#999"
              value={nombreGrupo}
              onChangeText={setNombreGrupo}
              autoFocus
            />
          </View>

          {/* Botón Crear */}
          <TouchableOpacity
            style={[estilos.botonPrimario, guardando && estilos.botonDeshabilitado]}
            onPress={iniciarConfirmacionCrear}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={estilos.textoBotonPrimario}>Crear</Text>
            )}
          </TouchableOpacity>

          {/* Botón Volver a las opciones */}
          <TouchableOpacity
            style={estilos.botonTexto}
            onPress={() => {
              setMostrarFormulario(false);
              setErrorMsg('');
            }}
            disabled={guardando}
          >
            <Text style={estilos.textoBotonTexto}>Volver a las opciones</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de Confirmación: Aceptar o Cancelar */}
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
                onPress={confirmarGuardadoGrupo}
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
  scrollContent: { padding: 24, justifyContent: 'center', alignItems: 'center', minHeight: '100%' },
  contenedorCargando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  textoCargando: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  contenedorLogo: {
    width: '100%',
    height: 90,
    borderWidth: 2,
    borderColor: '#A8D8D0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35,
    backgroundColor: '#F9FBFB',
  },
  textoLogo: { fontSize: 32, fontWeight: 'bold', color: '#60A5A3', letterSpacing: 4 },
  bloqueOpciones: { width: '100%', alignItems: 'center' },
  bloqueFormulario: { width: '100%' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 10, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 },
  botonPrimario: {
    width: '100%',
    backgroundColor: '#60A5A3',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  botonDeshabilitado: { opacity: 0.6 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  botonSecundario: {
    width: '100%',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#60A5A3',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  textoBotonSecundario: { color: '#60A5A3', fontSize: 16, fontWeight: 'bold' },
  notaSinLogica: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 4 },
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
  mensajeError: {
    color: '#D32F2F',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  botonTexto: { alignItems: 'center', marginTop: 10, paddingVertical: 8 },
  textoBotonTexto: { color: '#555555', fontSize: 15, textDecorationLine: 'underline' },

  // Estilos del Modal de Confirmación
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
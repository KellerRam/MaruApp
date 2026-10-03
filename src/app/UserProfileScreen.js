import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { cerrarSesion } from '../utils/session';

export default function UserProfileScreen() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [datosOriginales, setDatosOriginales] = useState(null);
  const [datosEditados, setDatosEditados] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [passwordEliminar, setPasswordEliminar] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  useEffect(() => {
    let activo = true;
    const cargarPerfil = async () => {
      try {
        const idUsuario = await AsyncStorage.getItem('userId');
        if (!activo) return;
        if (!idUsuario) {
          router.replace('/login');
          return;
        }

        const respuesta = await fetch(`${API_URL}/api/auth/user/${idUsuario}`);
        if (!respuesta.ok) throw new Error('No se pudo cargar el perfil');

        const datos = await respuesta.json();
        if (!activo) return;
        const fecha = datos.usuario.fecha_nacimiento_usuario?.split('T')[0].split('-') || ['', '', ''];
        const perfil = {
          nombre: datos.usuario.nombre_usuario || '',
          correo: datos.usuario.correo || '',
          genero: datos.usuario.genero || '',
          dia: fecha[2] || '',
          mes: fecha[1] || '',
          anio: fecha[0] || '',
        };
        setDatosOriginales(perfil);
        setDatosEditados(perfil);
      } catch (error) {
        if (activo) setErrorMsg(error.message);
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarPerfil();
    return () => { activo = false; };
  }, [router]);

  const [enfoqueNombre, setEnfoqueNombre] = useState(false);
  const [enfoqueFecha, setEnfoqueFecha] = useState(false);

  if (cargando || !datosEditados || !datosOriginales) {
    return <Text style={estilos.estado}>{errorMsg || 'Cargando perfil...'}</Text>;
  }

  const hayCambioNombre = datosEditados.nombre !== datosOriginales.nombre;
  const hayCambioGenero = datosEditados.genero !== datosOriginales.genero;
  const hayCambioFecha = 
    datosEditados.dia !== datosOriginales.dia || 
    datosEditados.mes !== datosOriginales.mes || 
    datosEditados.anio !== datosOriginales.anio;

  const guardarSeccion = async () => {
    setGuardando(true);
    setErrorMsg('');
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      const fechaNacimiento = `${datosEditados.anio}-${datosEditados.mes.padStart(2, '0')}-${datosEditados.dia.padStart(2, '0')}`;
      const respuesta = await fetch(`${API_URL}/api/auth/user/${idUsuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: datosEditados.nombre, genero: datosEditados.genero, fechaNacimiento }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el perfil');
      setDatosOriginales({ ...datosEditados });
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cancelarSeccion = (seccion) => {
    if (seccion === 'nombre') setDatosEditados({ ...datosEditados, nombre: datosOriginales.nombre });
    if (seccion === 'genero') setDatosEditados({ ...datosEditados, genero: datosOriginales.genero });
    if (seccion === 'fecha') setDatosEditados({ ...datosEditados, dia: datosOriginales.dia, mes: datosOriginales.mes, anio: datosOriginales.anio });
  };

  const cerrarModalEliminar = () => {
    setModalEliminar(false);
    setPasswordEliminar('');
    setErrorEliminar('');
  };

  const confirmarEliminarCuenta = async () => {
    if (!passwordEliminar.trim()) {
      setErrorEliminar('Ingresa tu contraseña para confirmar');
      return;
    }
    setEliminando(true);
    setErrorEliminar('');
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      const respuesta = await fetch(`${API_URL}/api/auth/user/${idUsuario}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordEliminar }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo eliminar la cuenta');

      await cerrarSesion();
      cerrarModalEliminar();
      router.replace('/');
    } catch (error) {
      setErrorEliminar(error.message);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      
      {/* Botón Cerrar */}
      <View style={estilos.encabezado}>
        <TouchableOpacity style={estilos.botonCerrar} onPress={() => router.push('/(tabs)')}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Avatar sin el ícono de lápiz */}
      <View style={estilos.contenedorAvatar}>
        <View style={estilos.circuloAvatar}>
          <Text style={estilos.textoAvatar}>
            {datosEditados.nombre.charAt(0).toUpperCase() || 'C'}
          </Text>
        </View>
      </View>

      {/* SECCIÓN: NOMBRE */}
      <View style={estilos.seccionCampo}>
        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput
          style={[
            estilos.inputTexto, 
            { color: enfoqueNombre ? '#000000' : '#444444' }
          ]}
          value={datosEditados.nombre}
          onChangeText={(val) => setDatosEditados({ ...datosEditados, nombre: val })}
          onFocus={() => setEnfoqueNombre(true)}
          onBlur={() => setEnfoqueNombre(false)}
        />
        <Text style={estilos.correo}>{datosEditados.correo}</Text>
        {hayCambioNombre && (
          <View style={estilos.botonesAccion}>
            <TouchableOpacity onPress={() => cancelarSeccion('nombre')} style={estilos.btnCancelar}>
              <Text style={estilos.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={guardarSeccion} style={estilos.btnGuardar} disabled={guardando}>
              <Text style={estilos.txtGuardar}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SECCIÓN: GÉNERO */}
      <View style={estilos.seccionCampo}>
        <Text style={estilos.etiqueta}>Género</Text>
        
        {['Femenino', 'Masculino', 'Otro'].map((opcion) => {
          const seleccionado = datosEditados.genero === opcion;
          return (
            <TouchableOpacity 
              key={opcion} 
              style={estilos.opcionRadio}
              onPress={() => setDatosEditados({ ...datosEditados, genero: opcion })}
            >
              <View style={[estilos.radioExterno, seleccionado && estilos.radioExternoSeleccionado]}>
                {seleccionado && <View style={estilos.radioInterno} />}
              </View>
              <Text style={[estilos.textoRadio, { color: seleccionado ? '#000000' : '#444444' }]}>
                {opcion}
              </Text>
            </TouchableOpacity>
          );
        })}

        {hayCambioGenero && (
          <View style={estilos.botonesAccion}>
            <TouchableOpacity onPress={() => cancelarSeccion('genero')} style={estilos.btnCancelar}>
              <Text style={estilos.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={guardarSeccion} style={estilos.btnGuardar} disabled={guardando}>
              <Text style={estilos.txtGuardar}>Guardar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SECCIÓN: FECHA DE NACIMIENTO */}
      <View style={estilos.seccionCampo}>
        <Text style={estilos.etiqueta}>Fecha de nacimiento</Text>
        <View style={estilos.contenedorFechas}>
          <View style={estilos.cajaFechaItem}>
            <TextInput
              style={[estilos.inputFecha, { color: enfoqueFecha ? '#000000' : '#444444' }]}
              value={datosEditados.dia}
              keyboardType="numeric"
              maxLength={2}
              onChangeText={(val) => setDatosEditados({ ...datosEditados, dia: val })}
              onFocus={() => setEnfoqueFecha(true)}
              onBlur={() => setEnfoqueFecha(false)}
            />
            <Text style={estilos.subEtiquetaFecha}>Día</Text>
          </View>

          <View style={estilos.cajaFechaItem}>
            <TextInput
              style={[estilos.inputFecha, { color: enfoqueFecha ? '#000000' : '#444444' }]}
              value={datosEditados.mes}
              keyboardType="numeric"
              maxLength={2}
              onChangeText={(val) => setDatosEditados({ ...datosEditados, mes: val })}
              onFocus={() => setEnfoqueFecha(true)}
              onBlur={() => setEnfoqueFecha(false)}
            />
            <Text style={estilos.subEtiquetaFecha}>Mes</Text>
          </View>

          <View style={estilos.cajaFechaItem}>
            <TextInput
              style={[estilos.inputFecha, { color: enfoqueFecha ? '#000000' : '#444444' }]}
              value={datosEditados.anio}
              keyboardType="numeric"
              maxLength={4}
              onChangeText={(val) => setDatosEditados({ ...datosEditados, anio: val })}
              onFocus={() => setEnfoqueFecha(true)}
              onBlur={() => setEnfoqueFecha(false)}
            />
            <Text style={estilos.subEtiquetaFecha}>Año</Text>
          </View>
        </View>

        {hayCambioFecha && (
          <View style={estilos.botonesAccion}>
            <TouchableOpacity onPress={() => cancelarSeccion('fecha')} style={estilos.btnCancelar}>
              <Text style={estilos.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={guardarSeccion} style={estilos.btnGuardar} disabled={guardando}>
              <Text style={estilos.txtGuardar}>Guardar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {errorMsg ? <Text style={estilos.mensajeError}>{errorMsg}</Text> : null}

      {/* SECCIÓN: ELIMINAR CUENTA */}
      <View style={estilos.seccionCampo}>
        <TouchableOpacity style={estilos.btnEliminarCuenta} onPress={() => setModalEliminar(true)}>
          <Feather name="trash-2" size={16} color="#B00020" style={{ marginRight: 8 }} />
          <Text style={estilos.txtEliminarCuenta}>Eliminar cuenta</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalEliminar} transparent animationType="fade" onRequestClose={cerrarModalEliminar}>
        <View style={estilos.fondoModalEliminar}>
          <View style={estilos.cajaModalEliminar}>
            <Text style={estilos.tituloModalEliminar}>Eliminar cuenta</Text>
            <Text style={estilos.textoModalEliminar}>
              Esta acción es permanente. Ingresa tu contraseña para confirmar la eliminación de tu cuenta.
            </Text>
            <TextInput
              style={estilos.inputPasswordEliminar}
              placeholder="Contraseña"
              placeholderTextColor="#48d9d9"
              secureTextEntry
              value={passwordEliminar}
              onChangeText={setPasswordEliminar}
            />
            {errorEliminar ? <Text style={estilos.mensajeError}>{errorEliminar}</Text> : null}
            <View style={estilos.botonesAccion}>
              <TouchableOpacity onPress={cerrarModalEliminar} style={estilos.btnCancelar}>
                <Text style={estilos.txtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarEliminarCuenta}
                style={estilos.btnConfirmarEliminar}
                disabled={eliminando}
              >
                <Text style={estilos.txtGuardar}>{eliminando ? 'Eliminando...' : 'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  encabezado: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  botonCerrar: { padding: 6 },
  contenedorAvatar: { alignItems: 'center', marginBottom: 20 },
  circuloAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#A8D8D0', justifyContent: 'center', alignItems: 'center' },
  textoAvatar: { fontSize: 45, fontWeight: '400', color: '#111' },
  seccionCampo: { marginBottom: 20 },
  etiqueta: { fontSize: 14, color: '#000', marginBottom: 6, fontWeight: '400' },
  inputTexto: { borderWidth: 1, borderColor: '#888', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, backgroundColor: '#FFF' },
  opcionRadio: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  radioExterno: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#008B8B', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioExternoSeleccionado: { borderColor: '#008B8B' },
  radioInterno: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#008B8B' },
  textoRadio: { fontSize: 15 },
  contenedorFechas: { flexDirection: 'row', justifyContent: 'space-between' },
  cajaFechaItem: { width: '30%', alignItems: 'center' },
  inputFecha: { width: '100%', borderWidth: 1, borderColor: '#888', borderRadius: 10, textAlign: 'center', paddingVertical: 10, fontSize: 16, backgroundColor: '#FFF' },
  subEtiquetaFecha: { fontSize: 12, color: '#333', marginTop: 4 },
  botonesAccion: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 },
  btnCancelar: { marginRight: 16, paddingVertical: 6, paddingHorizontal: 10 },
  txtCancelar: { color: '#008B8B', fontSize: 14, fontWeight: '600' },
  btnGuardar: { backgroundColor: '#008B8B', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 18 },
  txtGuardar: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  correo: { color: '#666', fontSize: 14, marginTop: 8 },
  mensajeError: { color: '#B00020', textAlign: 'center', marginBottom: 12 },
  estado: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: '#555' },
  btnEliminarCuenta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B00020', borderRadius: 18, paddingVertical: 12 },
  txtEliminarCuenta: { color: '#B00020', fontSize: 15, fontWeight: '600' },
  fondoModalEliminar: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  cajaModalEliminar: { width: '86%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  tituloModalEliminar: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  textoModalEliminar: { fontSize: 14, color: '#444', marginBottom: 16, lineHeight: 20 },
  inputPasswordEliminar: { borderWidth: 1, borderColor: '#888', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, backgroundColor: '#FFF', marginBottom: 8 },
  btnConfirmarEliminar: { backgroundColor: '#B00020', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 18 },
});
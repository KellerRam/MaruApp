import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../../config/api';

const horaSinSegundos = (hora) => String(hora || '').slice(0, 5);

const convertirFechaHora = (fecha, hora) => {
  const fechaTexto = String(fecha || '').slice(0, 10);
  const horaTexto = horaSinSegundos(hora);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaTexto)) return null;
  return new Date(`${fechaTexto}T${horaTexto}:00`);
};

const formatoFecha = (fecha) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric'
}).format(fecha);

const fechaLocalISO = (fecha) => {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

export default function PantallaInicio() {
  const [datosPantalla, setDatosPantalla] = useState({
    cuidadorActual: 'Cargando...',
    proximaToma: 'no hay tomas registradas',
    proximoCuidador: '',
    actividadProxima: '',
    fechaActual: new Date().getDate().toString(),
    diaActual: new Intl.DateTimeFormat('es', { weekday: 'long' }).format(new Date()).toUpperCase(),
  });
  const [idGrupo, setIdGrupo] = useState(null);
  const [idUsuario, setIdUsuario] = useState(null);
  const [modalSintoma, setModalSintoma] = useState(false);
  const [nombreSintoma, setNombreSintoma] = useState('');
  const [descripcionSintoma, setDescripcionSintoma] = useState('');
  const [fechaSintoma, setFechaSintoma] = useState(fechaLocalISO(new Date()));
  const [horaSintoma, setHoraSintoma] = useState(horaSinSegundos(new Date().toTimeString()));
  const [guardandoSintoma, setGuardandoSintoma] = useState(false);

  useEffect(() => {
    const cargarResumen = async () => {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) return;

      const grupoRespuesta = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
      if (!grupoRespuesta.ok) return;
      const grupoDatos = await grupoRespuesta.json();
      const grupo = grupoDatos.grupo;
      if (!grupo?.id_grupo) return;
      setIdGrupo(grupo.id_grupo);
      setIdUsuario(Number(idUsuario));

      const calendarioRespuesta = await fetch(`${API_URL}/api/calendar/group/${grupo.id_grupo}`);
      const calendario = calendarioRespuesta.ok ? await calendarioRespuesta.json() : { eventos: [] };
      const horariosRespuesta = await fetch(`${API_URL}/api/schedules/${grupo.id_grupo}`);
      const horarios = horariosRespuesta.ok ? await horariosRespuesta.json() : { horariosCuidado: [], medicamentos: [] };
      const ahora = new Date();
      const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const medicamento = (horarios.medicamentos || [])
        .map((item) => ({ item, fechaHora: convertirFechaHora(item.fecha_inicio, item.hora_toma) }))
        .filter(({ fechaHora }) => fechaHora && fechaHora >= ahora)
        .sort((a, b) => a.fechaHora - b.fechaHora)[0];
      const cuidado = (horarios.horariosCuidado || [])
        .map((item) => ({ item, inicio: convertirFechaHora(item.fecha_inicio, item.hora_inicio), fin: convertirFechaHora(item.fecha_fin, item.hora_fin) }))
        .filter(({ inicio, fin }) => inicio && inicio >= inicioDelDia && fin && fin >= ahora)
        .sort((a, b) => (a.inicio || a.fin) - (b.inicio || b.fin))[0];
      const evento = (calendario.eventos || [])
        .map((item) => ({ item, fechaHora: convertirFechaHora(item.fecha_evento, item.hora_evento) }))
        .filter(({ fechaHora }) => fechaHora && fechaHora >= ahora)
        .sort((a, b) => a.fechaHora - b.fechaHora)[0];
      const toma = medicamento?.item;
      const turno = cuidado?.item;
      const proximoEvento = evento?.item;

      setDatosPantalla((actual) => ({
        ...actual,
        cuidadorActual: grupo.nombre_grupo,
        proximaToma: toma ? `${horaSinSegundos(toma.hora_toma)} - ${toma.nombre_medicamento}: ${toma.dosis}` : 'no hay tomas registradas',
        proximoCuidador: turno ? `${horaSinSegundos(turno.hora_inicio)} - ${horaSinSegundos(turno.hora_fin)} ${turno.encargado}` : '',
        actividadProxima: proximoEvento ? `${formatoFecha(convertirFechaHora(proximoEvento.fecha_evento, proximoEvento.hora_evento))} - ${horaSinSegundos(proximoEvento.hora_evento)} - ${proximoEvento.nombre_evento}` : '',
      }));
    };

    cargarResumen().catch((error) => console.error('Error al cargar resumen:', error));
  }, []);

  const activarEmergencia = () => {
    Alert.alert('Emergencia', '¿Deseas notificar a todos los miembros del grupo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Activar',
        style: 'destructive',
        onPress: async () => {
          try {
            const respuesta = await fetch(`${API_URL}/api/emergency/group/${idGrupo}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idUsuario }),
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo activar la emergencia');
            Alert.alert('Emergencia activada', 'Se notificó a todos los miembros y se registró en el chat.');
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const registrarSintoma = async () => {
    if (!nombreSintoma.trim() || !descripcionSintoma.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fechaSintoma) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaSintoma)) {
      Alert.alert('Datos incompletos', 'Completa síntoma, descripción, fecha (AAAA-MM-DD) y hora (HH:MM).');
      return;
    }
    setGuardandoSintoma(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario, nombre_sintoma: nombreSintoma, descripcion: descripcionSintoma, fecha_sintoma: fechaSintoma, hora_sintoma: horaSintoma }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo registrar el síntoma');
      setModalSintoma(false);
      setNombreSintoma('');
      setDescripcionSintoma('');
      Alert.alert('Síntoma registrado', 'El síntoma se guardó correctamente.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardandoSintoma(false);
    }
  };

  return (
    
    <SafeAreaView style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.contenidoScroll}>
        
        {/* Encabezado */}
        <View style={estilos.encabezado}>
          <Text style={estilos.textoBienvenida}>¡Bienvenido! {datosPantalla.cuidadorActual}</Text>
        </View>

        <TouchableOpacity style={estilos.botonEmergencia} onPress={activarEmergencia}>
          <Text style={estilos.textoEmergencia}>EMERGENCIA</Text>
        </TouchableOpacity>

        <View style={estilos.tarjetaPrincipal}>
          <View style={estilos.columnaIzquierda}>
            <Text style={estilos.textoDia}>HOY {datosPantalla.diaActual}</Text>
            <Text style={estilos.textoFecha}>{datosPantalla.fechaActual}</Text>
          </View>
          
          <TouchableOpacity style={estilos.botonCita}>
            <Text style={estilos.textoBotonCita}>{datosPantalla.actividadProxima}</Text>
          </TouchableOpacity>
        </View>

        <View style={estilos.tarjetaSecundaria}>
          <Text style={estilos.tituloTarjeta}>Próxima Toma:</Text>
          <Text style={estilos.contenidoTarjeta}>{datosPantalla.proximaToma}</Text>
        </View>

        <View style={estilos.tarjetaSecundaria}>
          <Text style={estilos.tituloTarjeta}>Próximo Cuidador:</Text>
          <Text style={estilos.contenidoTarjeta}>{datosPantalla.proximoCuidador}</Text>
        </View>

        <TouchableOpacity style={estilos.botonRegistrarSintomas} onPress={() => setModalSintoma(true)}>
          <Text style={estilos.textoRegistrarSintomas}>REGISTRAR SÍNTOMAS</Text>
        </TouchableOpacity>

        <Modal visible={modalSintoma} transparent animationType="fade" onRequestClose={() => setModalSintoma(false)}>
          <View style={estilos.fondoModal}>
            <View style={estilos.modalSintoma}>
              <Text style={estilos.tituloModal}>Registrar síntoma</Text>
              <TextInput style={estilos.inputSintoma} placeholder="Síntoma" value={nombreSintoma} onChangeText={setNombreSintoma} />
              <TextInput style={[estilos.inputSintoma, estilos.inputDescripcion]} placeholder="Breve descripción" value={descripcionSintoma} onChangeText={setDescripcionSintoma} multiline />
              <TextInput style={estilos.inputSintoma} placeholder="Fecha (AAAA-MM-DD)" value={fechaSintoma} onChangeText={setFechaSintoma} />
              <TextInput style={estilos.inputSintoma} placeholder="Hora (HH:MM)" value={horaSintoma} onChangeText={setHoraSintoma} />
              <TouchableOpacity style={estilos.botonGuardarSintoma} onPress={registrarSintoma} disabled={guardandoSintoma}>
                <Text style={estilos.textoGuardarSintoma}>{guardandoSintoma ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={estilos.botonCancelarSintoma} onPress={() => setModalSintoma(false)}>
                <Text style={estilos.textoCancelarSintoma}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contenidoScroll: {
    padding: 20,
  },
  encabezado: {
    marginBottom: 16,
  },
  textoBienvenida: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555555',
    lineHeight: 28,
  },
  botonEmergencia: {
    backgroundColor: '#cc60eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  textoEmergencia: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tarjetaPrincipal: {
    backgroundColor: '#A8D8D0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  columnaIzquierda: {
    justifyContent: 'center',
  },
  textoDia: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#222222',
  },
  textoFecha: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222222',
    marginTop: 2,
  },
  botonCita: {
    backgroundColor: '#B5F062',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: '65%',
  },
  textoBotonCita: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tarjetaSecundaria: {
    backgroundColor: '#C8E8E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tituloTarjeta: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
  },
  contenidoTarjeta: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
  },
  botonRegistrarSintomas: {
    backgroundColor: '#C8E8E2',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  textoRegistrarSintomas: {
    color: '#111111',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSintoma: {
    width: '86%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  tituloModal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
  },
  inputSintoma: {
    borderWidth: 1,
    borderColor: '#A8D8D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#222222',
  },
  inputDescripcion: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  botonGuardarSintoma: {
    backgroundColor: '#008B8B',
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  textoGuardarSintoma: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  botonCancelarSintoma: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  textoCancelarSintoma: {
    color: '#666666',
  },
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FormPickerInput from '../../components/ui/FormPickerInput';
import { API_URL } from '../../config/api';
import { apiFetch as fetch } from '../../config/apiFetch';

const horaSinSegundos = (hora) => String(hora || '').slice(0, 5);

const convertirFechaHora = (fecha, hora) => {
  const fechaTexto = String(fecha || '').slice(0, 10);
  const horaTexto = horaSinSegundos(hora);
  
  const esFechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto);
  const esHoraValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaTexto);

  if (!esFechaValida || !esHoraValida) return null;
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

const ESCALA_ANIMO = [
  { valor: 'mal', emoji: '😞', etiqueta: 'Mal' },
  { valor: 'regular', emoji: '😐', etiqueta: 'Regular' },
  { valor: 'bien', emoji: '🙂', etiqueta: 'Bien' },
  { valor: 'muy_bien', emoji: '😄', etiqueta: 'Muy bien' },
];

export default function PantallaInicio() {
  const pathname = usePathname();
  const [datosPantalla, setDatosPantalla] = useState({
    cuidadorActual: 'Cargando...',
    proximaToma: 'No hay tomas registradas',
    proximoCuidador: 'No hay turnos registrados',
    actividadProxima: 'No hay eventos próximos',
    fechaActual: new Date().getDate().toString(),
    diaActual: new Intl.DateTimeFormat('es', { weekday: 'long' }).format(new Date()).toUpperCase(),
  });
  const [idGrupo, setIdGrupo] = useState(null);
  const [idUsuario, setIdUsuario] = useState(null);
  const [tienePaciente, setTienePaciente] = useState(false);
  const [modalSintoma, setModalSintoma] = useState(false);
  const [nombreSintoma, setNombreSintoma] = useState('');
  const [descripcionSintoma, setDescripcionSintoma] = useState('');
  const [fechaSintoma, setFechaSintoma] = useState(fechaLocalISO(new Date()));
  const [horaSintoma, setHoraSintoma] = useState(horaSinSegundos(new Date().toTimeString()));
  const [guardandoSintoma, setGuardandoSintoma] = useState(false);
  const [modalAnimo, setModalAnimo] = useState(false);
  const [animoSeleccionado, setAnimoSeleccionado] = useState(null);
  const [textoAnimo, setTextoAnimo] = useState('');
  const [guardandoAnimo, setGuardandoAnimo] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const cargarResumen = async () => {
      try {
        const idUsuarioActivo = await AsyncStorage.getItem('userId');
        if (!idUsuarioActivo || !isMounted) return;

        const grupoRespuesta = await fetch(`${API_URL}/api/groups/user/${idUsuarioActivo}`);
        if (!grupoRespuesta.ok) return;
        const grupoDatos = await grupoRespuesta.json();
        const grupo = grupoDatos.grupo;
        if (!grupo?.id_grupo || !isMounted) return;
        
        setIdGrupo(grupo.id_grupo);
        setIdUsuario(Number(idUsuarioActivo));

        // Verificar en tiempo real si el grupo tiene un miembro con rol de paciente
        const miembrosRes = await fetch(`${API_URL}/api/groups/${grupo.id_grupo}/members`);
        if (miembrosRes.ok && isMounted) {
          const miembrosDatos = await miembrosRes.json();
          const miembros = miembrosDatos.miembros || [];
          const existePaciente = miembros.some(
            (m) => String(m.rol || '').trim().toLowerCase() === 'paciente'
          );
          setTienePaciente(existePaciente);

          const propio = miembros.find((m) => Number(m.id_usuario) === Number(idUsuarioActivo));
          const esPaciente = String(propio?.rol || '').trim().toLowerCase() === 'paciente';
          if (esPaciente) {
            const hoyISO = fechaLocalISO(new Date());
            const claveCheckin = `ultimoCheckinAnimo_${idUsuarioActivo}`;
            const ultimoCheckin = await AsyncStorage.getItem(claveCheckin);
            if (ultimoCheckin !== hoyISO && isMounted) {
              setModalAnimo(true);
            }
          }
        }

        const calendarioRespuesta = await fetch(`${API_URL}/api/calendar/group/${grupo.id_grupo}`);
        const calendario = calendarioRespuesta.ok ? await calendarioRespuesta.json() : { eventos: [] };
        const horariosRespuesta = await fetch(`${API_URL}/api/schedules/${grupo.id_grupo}`);
        const horarios = horariosRespuesta.ok ? await horariosRespuesta.json() : { horariosCuidado: [], medicamentos: [] };
        
        if (!isMounted) return;

        const ahora = new Date();
        const limiteUnDia = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
        const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

        const medicamento = (horarios.medicamentos || [])
          .map((item) => ({ item, fechaHora: convertirFechaHora(item.fecha_inicio, item.hora_toma) }))
          .filter(({ fechaHora }) => fechaHora && fechaHora >= ahora && fechaHora <= limiteUnDia)
          .sort((a, b) => a.fechaHora - b.fechaHora)[0];

        const cuidado = (horarios.horariosCuidado || [])
          .map((item) => ({ item, inicio: convertirFechaHora(item.fecha_inicio, item.hora_inicio), fin: convertirFechaHora(item.fecha_fin, item.hora_fin) }))
          .filter(({ inicio, fin }) => inicio && inicio >= inicioDelDia && fin && fin >= ahora && fin <= limiteUnDia)
          .sort((a, b) => (a.inicio || a.fin) - (b.inicio || b.fin))[0];

        const evento = (calendario.eventos || [])
          .map((item) => ({ item, fechaHora: convertirFechaHora(item.fecha_evento, item.hora_evento) }))
          .filter(({ fechaHora }) => fechaHora && fechaHora >= ahora && fechaHora <= limiteUnDia)
          .sort((a, b) => a.fechaHora - b.fechaHora)[0];

        const toma = medicamento?.item;
        const turno = cuidado?.item;
        const proximoEvento = evento?.item;

        setDatosPantalla((actual) => ({
          ...actual,
          cuidadorActual: grupo.nombre_grupo,
          proximaToma: toma ? `${horaSinSegundos(toma.hora_toma)} - ${toma.nombre_medicamento}: ${toma.dosis}` : 'no hay tomas registradas',
          proximoCuidador: turno ? `${horaSinSegundos(turno.hora_inicio)} - ${horaSinSegundos(turno.hora_fin)} ${turno.encargado}` : 'No hay turnos registrados',
          actividadProxima: proximoEvento ? `${formatoFecha(convertirFechaHora(proximoEvento.fecha_evento, proximoEvento.hora_evento))} - ${horaSinSegundos(proximoEvento.hora_evento)} - ${proximoEvento.nombre_evento}` : 'No hay eventos próximos',
        }));
      } catch (error) {
        console.error('Error al cargar resumen:', error);
      }
    };

    cargarResumen();

    const intervalo = setInterval(() => {
      if (AppState.currentState === 'active') cargarResumen();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalo);
    };
  }, [pathname]); // Se dispara y actualiza al instante cada vez que cambia la ruta de navegación

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

  const marcarCheckinDeHoy = async () => {
    if (!idUsuario) return;
    await AsyncStorage.setItem(`ultimoCheckinAnimo_${idUsuario}`, fechaLocalISO(new Date()));
  };

  const omitirCheckinAnimo = async () => {
    await marcarCheckinDeHoy();
    setModalAnimo(false);
    setAnimoSeleccionado(null);
    setTextoAnimo('');
  };

  const guardarCheckinAnimo = async () => {
    if (!animoSeleccionado) {
      Alert.alert('Selecciona una opción', 'Elige el emoji que mejor represente cómo te sientes hoy.');
      return;
    }
    setGuardandoAnimo(true);
    try {
      const opcion = ESCALA_ANIMO.find((o) => o.valor === animoSeleccionado);
      const ahora = new Date();

      const respuestaSintoma = await fetch(`${API_URL}/api/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario,
          nombre_sintoma: 'Estado de ánimo',
          descripcion: textoAnimo.trim() || opcion.etiqueta,
          fecha_sintoma: fechaLocalISO(ahora),
          hora_sintoma: horaSinSegundos(ahora.toTimeString()),
        }),
      });
      const datosSintoma = await respuestaSintoma.json();
      if (!respuestaSintoma.ok) throw new Error(datosSintoma.error || 'No se pudo guardar el estado de ánimo');

      await marcarCheckinDeHoy();
      setModalAnimo(false);
      setAnimoSeleccionado(null);
      setTextoAnimo('');

      if (idGrupo) {
        try {
          const respuestaChat = await fetch(`${API_URL}/api/chat/group/${idGrupo}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idUsuario,
              tipo: 'texto',
              texto: `${opcion.emoji} Estado de ánimo de hoy${textoAnimo.trim() ? `: ${textoAnimo.trim()}` : ''}`,
              solo_cuidadores: true,
            }),
          });
          if (!respuestaChat.ok) throw new Error('No se pudo compartir el estado de ánimo con cuidadores');
        } catch (error) {
          console.error('No se pudo publicar el estado de ánimo en el chat:', error.message);
          Alert.alert('Estado guardado', 'Se guardó el check-in, pero no se pudo compartir en el chat.');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo guardar el estado de ánimo.');
    } finally {
      setGuardandoAnimo(false);
    }
  };

  const abrirModalSintoma = () => {
    if (!tienePaciente) {
      Alert.alert('Atención', 'No hay un paciente asignado');
      return;
    }
    setModalSintoma(true);
  };

  const registrarSintoma = async () => {
    const esFechaSintomaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaSintoma);
    const esHoraSintomaValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaSintoma);

    if (!nombreSintoma.trim() || !descripcionSintoma.trim() || !esFechaSintomaValida || !esHoraSintomaValida) {
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

        <TouchableOpacity style={estilos.botonRegistrarSintomas} onPress={abrirModalSintoma}>
          <Text style={estilos.textoRegistrarSintomas}>REGISTRAR SÍNTOMAS</Text>
        </TouchableOpacity>

        <Modal visible={modalSintoma} transparent animationType="fade" onRequestClose={() => setModalSintoma(false)}>
          <KeyboardAvoidingView style={estilos.fondoModal} behavior="padding">
            <View style={estilos.modalSintoma}>
              <Text style={estilos.tituloModal}>Registrar síntoma</Text>
              <TextInput style={estilos.inputSintoma} placeholder="Síntoma" placeholderTextColor="#48d9d9" value={nombreSintoma} onChangeText={setNombreSintoma} />
              <TextInput style={[estilos.inputSintoma, estilos.inputDescripcion]} placeholder="Breve descripción" placeholderTextColor="#48d9d9" value={descripcionSintoma} onChangeText={setDescripcionSintoma} multiline />
              <FormPickerInput
                pickerType="date"
                modalTitle="Fecha del síntoma"
                style={estilos.inputSintoma}
                placeholder="Fecha (AAAA-MM-DD)"
                value={fechaSintoma}
                onChangeText={setFechaSintoma}
              />
              <FormPickerInput
                pickerType="time"
                modalTitle="Hora del síntoma"
                style={estilos.inputSintoma}
                placeholder="Hora (HH:MM)"
                value={horaSintoma}
                onChangeText={setHoraSintoma}
              />
              <TouchableOpacity style={estilos.botonGuardarSintoma} onPress={registrarSintoma} disabled={guardandoSintoma}>
                <Text style={estilos.textoGuardarSintoma}>{guardandoSintoma ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={estilos.botonCancelarSintoma} onPress={() => setModalSintoma(false)}>
                <Text style={estilos.textoCancelarSintoma}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={modalAnimo} transparent animationType="fade" onRequestClose={omitirCheckinAnimo}>
          <KeyboardAvoidingView style={estilos.fondoModal} behavior="padding">
            <View style={estilos.modalAnimo}>
              <TouchableOpacity style={estilos.botonCerrarAnimo} onPress={omitirCheckinAnimo}>
                <Text style={estilos.textoCerrarAnimo}>✕</Text>
              </TouchableOpacity>
              <Text style={estilos.tituloModalAnimo}>¿Cómo se siente hoy?</Text>
              <View style={estilos.filaEmojis}>
                {ESCALA_ANIMO.map((opcion) => (
                  <TouchableOpacity
                    key={opcion.valor}
                    style={[estilos.circuloEmoji, animoSeleccionado === opcion.valor && estilos.circuloEmojiActivo]}
                    onPress={() => setAnimoSeleccionado(opcion.valor)}
                  >
                    <Text style={estilos.textoEmoji}>{opcion.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={estilos.inputAnimo}
                placeholder="Agregar síntoma..."
                placeholderTextColor="#48d9d9"
                value={textoAnimo}
                onChangeText={setTextoAnimo}
                multiline
              />
              <TouchableOpacity style={estilos.botonGuardarAnimo} onPress={guardarCheckinAnimo} disabled={guardandoAnimo}>
                <Text style={estilos.textoGuardarAnimo}>{guardandoAnimo ? 'GUARDANDO...' : 'GUARDAR'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={omitirCheckinAnimo}>
                <Text style={estilos.textoOmitirAnimo}>Omitir</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
  modalAnimo: {
    width: '86%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  botonCerrarAnimo: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  textoCerrarAnimo: {
    fontSize: 16,
    color: '#333333',
  },
  tituloModalAnimo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  filaEmojis: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  circuloEmoji: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFDE59',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circuloEmojiActivo: {
    borderWidth: 3,
    borderColor: '#008B8B',
  },
  textoEmoji: {
    fontSize: 26,
  },
  inputAnimo: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
    textAlignVertical: 'top',
    color: '#222222',
    marginBottom: 20,
  },
  botonGuardarAnimo: {
    width: '100%',
    backgroundColor: '#A8D8D0',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  textoGuardarAnimo: {
    color: '#0A3D4C',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  textoOmitirAnimo: {
    color: '#60A5A3',
    fontSize: 14,
    fontWeight: '600',
  },
});
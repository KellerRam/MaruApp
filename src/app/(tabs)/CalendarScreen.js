// src/app/calendarScreen.js
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../config/api';

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const NOMBRES_DIAS_SEMANA = [
  'DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'
];

const diasSemanaExtendido = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const diasSemanaPequeno = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const formatearFechaISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

export const esFechaPasada = (anio, mesNum1Indexed, dia) => {
  const fecha = new Date(anio, mesNum1Indexed - 1, dia, 23, 59, 59, 999);
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
  return fecha.getTime() < inicioHoy.getTime();
};

export const calcularColorEvento = (fechaStr, horaStr) => {
  if (!fechaStr) return '#38b6ff';
  const hora = (horaStr || '00:00:00').substring(0, 8);
  const partesFecha = fechaStr.split('-').map(Number);
  const partesHora = hora.split(':').map(Number);

  if (partesFecha.length !== 3) return '#38b6ff';

  const [anio, mes, dia] = partesFecha;
  const h = partesHora[0] || 0;
  const m = partesHora[1] || 0;
  const s = partesHora[2] || 0;

  const fechaObj = new Date(anio, mes - 1, dia, h, m, s);
  const ahora = new Date();
  const diffMs = fechaObj.getTime() - ahora.getTime();
  const diffHoras = diffMs / (1000 * 60 * 60);

  if (diffHoras < 0) {
    return '#9E9E9E';
  }
  if (diffHoras <= 24) {
    return '#ffde59';
  }
  if (diffHoras <= 72) {
    return '#c1ff72';
  }
  return '#38b6ff';
};

const generarLoteMeses = (mesInicio, anioInicio, cantidadMeses = 12) => {
  const resultado = [];
  let m = mesInicio;
  let a = anioInicio;

  for (let i = 0; i < cantidadMeses; i++) {
    const totalDias = new Date(a, m, 0).getDate();
    const diaSemanaInicio = new Date(a, m - 1, 1).getDay();
    const nombreMes = NOMBRES_MESES[m - 1];

    resultado.push({
      key: `${a}-${m}`,
      mesNum: m,
      anioNum: a,
      nombreMes,
      totalDias,
      diaSemanaInicio,
    });

    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return resultado;
};

export default function PantallaCalendario() {
  const [fechaActual, setFechaActual] = useState(new Date());

  const diaHoy = fechaActual.getDate();
  const mesHoy = fechaActual.getMonth() + 1;
  const anioHoy = fechaActual.getFullYear();
  const diaSemanaHoy = fechaActual.getDay();
  const textoDiaHoy = `HOY ${NOMBRES_DIAS_SEMANA[diaSemanaHoy]}`;

  const [diaSeleccionado, setDiaSeleccionado] = useState(diaHoy);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesHoy);
  const [anioSeleccionado, setAnioSeleccionado] = useState(anioHoy);

  const [listaMeses, setListaMeses] = useState(() => generarLoteMeses(mesHoy, anioHoy, 12));
  const [mesEnVista, setMesEnVista] = useState(NOMBRES_MESES[mesHoy - 1]);
  const [anioEnVista, setAnioEnVista] = useState(anioHoy);

  const [idCalendario, setIdCalendario] = useState(null);
  const [idGrupo, setIdGrupo] = useState(null);
  const [horariosCuidado, setHorariosCuidado] = useState([]);
  const [horariosMedicamentos, setHorariosMedicamentos] = useState([]);
  const [cuidadoresDisponibles, setCuidadoresDisponibles] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  const [mostrarCalendarioExtendido, setMostrarCalendarioExtendido] = useState(false);
  const [modalGestionHorario, setModalGestionHorario] = useState(false);
  const [modalDetalleRegistro, setModalDetalleRegistro] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [tipoGestion, setTipoGestion] = useState('cuidado');

  // Campos Horario Cuidado (Modificados para Hora Inicio y Hora Fin intuitivas)
  const [encargadoCuidado, setEncargadoCuidado] = useState('');
  const [horaInicioCuidado, setHoraInicioCuidado] = useState('08:00');
  const [horaFinCuidado, setHoraFinCuidado] = useState('16:00');
  const [fechaFormulario, setFechaFormulario] = useState(formatearFechaISO(fechaActual));

  const [nombreMed, setNombreMed] = useState('');
  const [dosisMed, setDosisMed] = useState('');
  const [presentacionMed, setPresentacionMed] = useState('');
  const [frecuenciaMed, setFrecuenciaMed] = useState('Cada 8 horas');
  const [horaTomaMed, setHoraTomaMed] = useState('16:00');

  const [nombreEvento, setNombreEvento] = useState('');
  const [horaEvento, setHoraEvento] = useState('16:00');
  const [fechaEvento, setFechaEvento] = useState(formatearFechaISO(fechaActual));

  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  const cargarCuidadores = async (grupoId) => {
    const respuesta = await fetch(`${API_URL}/api/groups/${grupoId}/members`);
    if (!respuesta.ok) {
      throw new Error('No se pudo cargar la lista de miembros');
    }

    const datos = await respuesta.json();
    const cuidadores = (datos.miembros || []).filter(
      (miembro) => String(miembro.rol || '').trim().toLowerCase() === 'cuidador'
    );
    setCuidadoresDisponibles(cuidadores);
    return cuidadores;
  };

  const limpiarFormularioGestion = (fecha = formatearFechaISO(fechaActual)) => {
    setRegistroEditando(null);
    setTipoGestion('cuidado');
    setEncargadoCuidado('');
    setHoraInicioCuidado('08:00');
    setHoraFinCuidado('16:00');
    setNombreMed('');
    setDosisMed('');
    setPresentacionMed('');
    setFrecuenciaMed('Cada 8 horas');
    setHoraTomaMed('16:00');
    setNombreEvento('');
    setHoraEvento('16:00');
    setFechaFormulario(fecha);
    setFechaEvento(fecha);
    setErrorFormulario('');
  };

  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date();
      if (ahora.getDate() !== fechaActual.getDate() || ahora.getMonth() !== fechaActual.getMonth()) {
        setFechaActual(ahora);
        setDiaSeleccionado(ahora.getDate());
        setMesSeleccionado(ahora.getMonth() + 1);
        setAnioSeleccionado(ahora.getFullYear());
      }
    }, 60000);
    return () => clearInterval(intervalo);
  }, [fechaActual]);

  const cargarDatosServidor = useCallback(async () => {
    try {
      setCargandoDatos(true);
      let grupoId = null;
      const idUsuario = await AsyncStorage.getItem('userId');
      if (idUsuario) {
        const userGroupRes = await fetch(`${API_URL}/api/groups/user/${idUsuario}`);
        if (userGroupRes.ok) {
          const ugData = await userGroupRes.json();
          if (ugData.tieneGrupo && ugData.grupo?.id_grupo) {
            grupoId = ugData.grupo.id_grupo.toString();
            await AsyncStorage.setItem('groupId', grupoId);
          }
        }
      }

      if (!grupoId) {
        setErrorFormulario('No se encontró un grupo asociado al usuario');
        return;
      }

      setIdGrupo(grupoId);

      const respuesta = await fetch(`${API_URL}/api/calendar/group/${grupoId}`);
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setIdCalendario(datos.id_calendario);
        setEventos(datos.eventos || []);
      }

      const resHorarios = await fetch(`${API_URL}/api/schedules/${grupoId}`);
      if (resHorarios.ok) {
        const datosH = await resHorarios.json();
        setHorariosCuidado(datosH.horariosCuidado || []);
        setHorariosMedicamentos(datosH.medicamentos || []);
      }

      await cargarCuidadores(grupoId);
    } catch (error) {
      console.error('Error al cargar datos de la agenda:', error);
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  useEffect(() => {
    cargarDatosServidor();
  }, [cargarDatosServidor]);

  const cargarMasMesesProgresivo = () => {
    setListaMeses((mesesActuales) => {
      const ultimoMes = mesesActuales[mesesActuales.length - 1];
      let sigM = ultimoMes.mesNum + 1;
      let sigA = ultimoMes.anioNum;
      if (sigM > 12) {
        sigM = 1;
        sigA++;
      }
      const nuevoLote = generarLoteMeses(sigM, sigA, 12);
      return [...mesesActuales, ...nuevoLote];
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const primerItem = viewableItems[0].item;
      if (primerItem) {
        setMesEnVista(primerItem.nombreMes);
        setAnioEnVista(primerItem.anioNum);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 35,
  }).current;

  const abrirModalGestion = (fechaSugerida) => {
    let fechaFinal = fechaSugerida;
    if (!fechaFinal) {
      fechaFinal = formatearFechaISO(fechaActual);
    }
    limpiarFormularioGestion(fechaFinal);
    setModalGestionHorario(true);

    if (idGrupo) {
      cargarCuidadores(idGrupo).catch((error) => {
        setErrorFormulario(error.message);
      });
    }
  };

  const registrosDeFecha = (fechaISO) => [
    ...eventos.filter((evento) => String(evento.fecha_evento || '').split('T')[0] === fechaISO).map((evento) => ({
      ...evento, tipo: 'evento', hora: evento.hora_evento, titulo: evento.nombre_evento,
    })),
    ...horariosCuidado.filter((turno) => String(turno.fecha_inicio || '').split('T')[0] === fechaISO).map((turno) => ({
      ...turno, tipo: 'turno', hora: turno.hora_inicio, titulo: turno.encargado || 'Turno de cuidado',
    })),
    ...horariosMedicamentos.filter((toma) => String(toma.fecha_inicio || '').split('T')[0] === fechaISO).map((toma) => ({
      ...toma, tipo: 'toma', hora: toma.hora_toma, titulo: toma.nombre_medicamento,
    })),
  ].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

  const abrirDetalleRegistro = (registro) => {
    setRegistroSeleccionado(registro);
    setModalDetalleRegistro(true);
  };

  const editarRegistro = () => {
    const registro = registroSeleccionado;
    setModalDetalleRegistro(false);
    setRegistroEditando(registro);
    if (registro.tipo === 'evento') {
      setTipoGestion('evento');
      setNombreEvento(registro.nombre_evento);
      setFechaEvento(registro.fecha_evento);
      setHoraEvento(String(registro.hora_evento).substring(0, 5));
    } else if (registro.tipo === 'turno') {
      setTipoGestion('cuidado');
      setEncargadoCuidado(String(registro.id_cuidador));
      setFechaFormulario(registro.fecha_inicio);
      setHoraInicioCuidado(String(registro.hora_inicio).substring(0, 5));
      setHoraFinCuidado(String(registro.hora_fin).substring(0, 5));
    } else if (registro.tipo === 'toma') {
      setTipoGestion('medicamento');
      setNombreMed(registro.nombre_medicamento);
      setDosisMed(registro.dosis);
      setPresentacionMed(registro.presentacion);
      setFrecuenciaMed(registro.frecuencia || '');
      setHoraTomaMed(String(registro.hora_toma).substring(0, 5));
      setFechaFormulario(registro.fecha_inicio);
    }
    setErrorFormulario('');
    setModalGestionHorario(true);
  };

  const eliminarRegistro = async () => {
    const registro = registroSeleccionado;
    const endpoint = registro.tipo === 'evento'
      ? `${API_URL}/api/calendar/events/${registro.id_evento}`
      : registro.tipo === 'toma'
        ? `${API_URL}/api/schedules/medicamento/${registro.id_horario_medicamento}`
        : `${API_URL}/api/schedules/cuidado/${registro.id_horario_cuidado}`;
    try {
      const respuesta = await fetch(endpoint, { method: 'DELETE' });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo eliminar');
      setModalDetalleRegistro(false);
      setRegistroSeleccionado(null);
      setRegistroEditando(null);
      cargarDatosServidor();
    } catch (error) {
      Alert.alert('No se pudo eliminar', error.message);
    }
  };

  // Lógica para calcular la fecha fin, verificar cruces y límite de 24 horas
  const calcularFechasTurno = () => {
    const [anioF, mesF, diaF] = fechaFormulario.split('-').map(Number);
    const [hI, mI] = horaInicioCuidado.split(':').map(Number);
    const [hF, mF] = horaFinCuidado.split(':').map(Number);

    const inicio = new Date(anioF, mesF - 1, diaF, hI, mI, 0);
    let fin = new Date(anioF, mesF - 1, diaF, hF, mF, 0);

    // Si la hora fin es menor o igual a la hora inicio, asume que cruza a la medianoche del día siguiente
    if (fin <= inicio) {
      fin.setDate(fin.getDate() + 1);
    }

    const diffMs = fin.getTime() - inicio.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);

    return { inicio, fin, diffHoras };
  };

  const manejarGuardarHorario = async () => {
    setErrorFormulario('');

    if (!idGrupo) {
      setErrorFormulario('No se encontró el Grupo asignado');
      return;
    }

    try {
      setGuardandoHorario(true);
      let endpoint = '';
      let bodyData = {};
      let method = 'POST';

      if (tipoGestion === 'cuidado') {
        const horaInicioValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicioCuidado);
        const horaFinValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaFinCuidado);
        const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaFormulario);

        if (!encargadoCuidado || !horaInicioValida || !horaFinValida || !fechaValida) {
          setErrorFormulario('Selecciona un cuidador, fecha válida y horas HH:MM válidas');
          setGuardandoHorario(false);
          return;
        }

        const { inicio, fin, diffHoras } = calcularFechasTurno();

        // Validación: Ningún turno puede ser de más de 24 horas
        if (diffHoras > 24) {
          setErrorFormulario('Ningún turno puede exceder las 24 horas de duración.');
          setGuardandoHorario(false);
          return;
        }

        const cuidadorNum = Number(encargadoCuidado);
        const editId = registroEditando ? registroEditando.id_horario_cuidado : null;

        // Validación de traslapos de turnos en el frontend
        const solapado = horariosCuidado.some((t) => {
          if (Number(t.id_cuidador) !== cuidadorNum) return false;
          if (editId && t.id_horario_cuidado === editId) return false;

          const [a1, m1, d1] = String(t.fecha_inicio || '').split('T')[0].split('-').map(Number);
          const [hi1, mi1] = String(t.hora_inicio || '00:00:00').substring(0, 5).split(':').map(Number);
          const inicioExistente = new Date(a1, m1 - 1, d1, hi1, mi1, 0);

          const [a2, m2, d2] = String(t.fecha_fin || '').split('T')[0].split('-').map(Number);
          const [hf1, mf1] = String(t.hora_fin || '00:00:00').substring(0, 5).split(':').map(Number);
          let finExistente = new Date(a2, m2 - 1, d2, hf1, mf1, 0);
          if (finExistente <= inicioExistente) {
            finExistente.setDate(finExistente.getDate() + 1);
          }

          return inicio < finExistente && fin > inicioExistente;
        });

        if (solapado) {
          setErrorFormulario('El cuidador ya tiene un turno registrado que se cruza con este horario.');
          setGuardandoHorario(false);
          return;
        }

        const fechaFinStr = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
        const horaFinStr = `${String(fin.getHours()).padStart(2, '0')}:${String(fin.getMinutes()).padStart(2, '0')}:00`;

        endpoint = `${API_URL}/api/schedules/cuidado`;
        bodyData = {
          id_grupo: idGrupo,
          id_cuidador: cuidadorNum,
          fecha_inicio: fechaFormulario,
          fecha_fin: fechaFinStr,
          hora_inicio: `${horaInicioCuidado}:00`,
          hora_fin: horaFinStr,
        };
      } else if (tipoGestion === 'medicamento') {
        if (!nombreMed.trim() || !dosisMed.trim() || !presentacionMed.trim() || !horaTomaMed.trim()) {
          setErrorFormulario('Completa todos los campos del medicamento');
          setGuardandoHorario(false);
          return;
        }
        endpoint = `${API_URL}/api/schedules/medicamento`;
        bodyData = {
          id_grupo: idGrupo,
          nombre_medicamento: nombreMed.trim(),
          dosis: dosisMed.trim(),
          presentacion: presentacionMed.trim(),
          frecuencia: frecuenciaMed.trim(),
          hora_toma: horaTomaMed.trim(),
          fecha_inicio: fechaFormulario,
        };
      } else {
        if (!nombreEvento.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaEvento) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaEvento)) {
          setErrorFormulario('Completa el evento con fecha válida y hora HH:MM en formato de 24 horas');
          setGuardandoHorario(false);
          return;
        }
        endpoint = `${API_URL}/api/calendar/events`;
        bodyData = {
          nombre_evento: nombreEvento.trim(),
          fecha_evento: fechaEvento,
          hora_evento: horaEvento,
          id_calendario: idCalendario,
        };
      }

      if (registroEditando) {
        method = 'PUT';
        if (tipoGestion === 'evento') {
          endpoint = `${API_URL}/api/calendar/events/${registroEditando.id_evento}`;
        } else if (tipoGestion === 'cuidado') {
          endpoint = `${API_URL}/api/schedules/cuidado/${registroEditando.id_horario_cuidado}`;
          const { inicio, fin } = calcularFechasTurno();
          bodyData = {
            id_cuidador: Number(encargadoCuidado),
            fecha_inicio: fechaFormulario,
            fecha_fin: `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`,
            hora_inicio: `${horaInicioCuidado}:00`,
            hora_fin: `${String(fin.getHours()).padStart(2, '0')}:${String(fin.getMinutes()).padStart(2, '0')}:00`,
          };
        } else {
          endpoint = `${API_URL}/api/schedules/medicamento/${registroEditando.id_horario_medicamento}`;
          bodyData = {
            nombre_medicamento: nombreMed.trim(), dosis: dosisMed.trim(),
            presentacion: presentacionMed.trim(), frecuencia: frecuenciaMed.trim(),
            hora_toma: horaTomaMed.trim(), fecha_inicio: fechaFormulario,
          };
        }
      }

      const respuesta = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        setModalGestionHorario(false);
        limpiarFormularioGestion();
        cargarDatosServidor();
        Alert.alert('Éxito', 'Horario registrado correctamente en la base de datos');
      } else {
        setErrorFormulario(datos.error || 'Error al guardar el horario');
      }
    } catch (error) {
      setErrorFormulario('No se pudo conectar con el servidor');
    } finally {
      setGuardandoHorario(false);
    }
  };

  const obtenerEventosDeFecha = (fechaISO) => {
    return eventos.filter((ev) => {
      const coincideFecha = String(ev.fecha_evento || '').split('T')[0] === fechaISO;
      if (!busqueda.trim()) return coincideFecha;
      return coincideFecha && ev.nombre_evento.toLowerCase().includes(busqueda.toLowerCase());
    });
  };

  const obtenerEventosDeDia = (dia, mes, anio) => {
    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return obtenerEventosDeFecha(fechaISO);
  };

  const obtenerEventoPequenoDinamico = () => {
    const hoyISO = formatearFechaISO(fechaActual);
    const evsHoy = obtenerEventosDeFecha(hoyISO);
    if (evsHoy.length > 0) {
      return evsHoy[0].nombre_evento;
    }

    const manana = new Date(fechaActual.getTime() + 24 * 3600 * 1000);
    const mananaISO = formatearFechaISO(manana);
    const evsManana = obtenerEventosDeFecha(mananaISO);
    if (evsManana.length > 0) {
      return evsManana[0].nombre_evento;
    }

    return null;
  };

  const renderDiasCalendarioPequeno = () => {
    const totalDiasPequeno = new Date(anioHoy, mesHoy, 0).getDate();
    const primerDiaPequenoDom = new Date(anioHoy, mesHoy - 1, 1).getDay();
    const primerDiaLunes = (primerDiaPequenoDom + 6) % 7;

    const espaciosVacios = Array(primerDiaLunes).fill(null);
    const diasMes = Array.from({ length: totalDiasPequeno }, (_, i) => i + 1);
    const matrizTotal = [...espaciosVacios, ...diasMes];

    return matrizTotal.map((dia, idx) => {
      if (!dia) {
        return <View key={`empty-p-${idx}`} style={estilos.celdaDia} />;
      }

      const evs = obtenerEventosDeDia(dia, mesHoy, anioHoy);
      const tieneEvento = evs.length > 0;
      const colorEvento = tieneEvento ? calcularColorEvento(evs[0].fecha_evento, evs[0].hora_evento) : null;
      const esHoy = dia === diaHoy;

      return (
        <View
          key={`dia-p-${dia}`}
          style={[
            estilos.celdaDia,
            esHoy && estilos.diaHoy,
            tieneEvento && { backgroundColor: colorEvento },
          ]}
        >
          <Text
            style={[
              estilos.textoDiaNumero,
              (esHoy || tieneEvento) && estilos.textoDiaResaltado,
              tieneEvento && { color: colorEvento === '#38b6ff' ? '#FFFFFF' : '#000000' },
            ]}
          >
            {dia}
          </Text>
        </View>
      );
    });
  };

  const renderDetalleFecha = (fechaISO, mostrarBotonAgregar = true) => {
    const fecha = new Date(`${fechaISO}T00:00:00`);
    const registros = registrosDeFecha(fechaISO);
    const esPasada = esFechaPasada(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());

    return (
      <View style={estilos.tarjetaDetalleDia}>
        <View style={estilos.cabeceraDetalleDia}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.tituloDetalleDia}>
              {fecha.getDate()} de {NOMBRES_MESES[fecha.getMonth()]} de {fecha.getFullYear()}
            </Text>
          </View>
          {mostrarBotonAgregar && (
            <TouchableOpacity
              style={[estilos.botonAgregarEventoDia, esPasada && { opacity: 0.35 }]}
              onPress={() => {
                if (esPasada) {
                  Alert.alert('Fecha pasada', 'No se pueden programar horarios en fechas anteriores a la actual.');
                  return;
                }
                abrirModalGestion(fechaISO);
              }}
            >
              <Feather name="plus-circle" size={18} color="#3B7A8C" />
              <Text style={estilos.textoAgregarEventoDia}>Gestionar Horario</Text>
            </TouchableOpacity>
          )}
        </View>

        {registros.length === 0 ? (
          <Text style={estilos.textoSinEventos}>No hay registros para este día.</Text>
        ) : (
          registros.map((registro) => (
            <TouchableOpacity
              key={`${registro.tipo}-${registro.id_evento || registro.id_horario_cuidado || registro.id_horario_medicamento}`}
              style={estilos.itemEventoDetalle}
              onPress={() => abrirDetalleRegistro(registro)}
            >
              <View style={[estilos.puntoColorEvento, { backgroundColor: registro.tipo === 'evento' ? '#38b6ff' : registro.tipo === 'turno' ? '#c1ff72' : '#ffde59' }]} />
              <View style={estilos.infoEventoDetalle}>
                <Text style={estilos.tipoRegistro}>{registro.tipo.toUpperCase()}</Text>
                <Text style={estilos.nombreEventoDetalle}>{registro.titulo}</Text>
                <Text style={estilos.horaEventoDetalle}>Hora: {String(registro.hora || '').substring(0, 5)}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#888" />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderItemMes = ({ item }) => {
    const celdasVacias = Array(item.diaSemanaInicio).fill(null);
    const dias = Array.from({ length: item.totalDias }, (_, i) => i + 1);
    const todos = [...celdasVacias, ...dias];
    const filas = [];
    for (let indice = 0; indice < todos.length; indice += 7) {
      filas.push(todos.slice(indice, indice + 7));
    }

    return (
      <View style={estilos.seccionMesExtendido}>
        <View style={estilos.filaTituloMesAnio}>
          <Text style={estilos.tituloMesSeccion}>{item.nombreMes}</Text>
          <Text style={estilos.tituloAnioSeccion}>{item.anioNum}</Text>
        </View>

        <View style={estilos.cuadriculaDias}>
          {filas.map((fila, indiceFila) => {
            const contieneSeleccion = fila.some((dia) => (
              dia && dia === diaSeleccionado && item.mesNum === mesSeleccionado && item.anioNum === anioSeleccionado
            ));

            return (
              <View key={`fila-${item.key}-${indiceFila}`} style={estilos.filaSemanaCalendario}>
                {fila.map((dia, idx) => {
                  if (!dia) {
                    return <View key={`empty-${item.key}-${indiceFila}-${idx}`} style={estilos.celdaExtendidoVacia} />;
                  }

                  const fechaISO = `${item.anioNum}-${String(item.mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                  const evs = obtenerEventosDeFecha(fechaISO);
                  const tieneEvento = evs.length > 0;
                  const colorEvento = tieneEvento ? calcularColorEvento(evs[0].fecha_evento, evs[0].hora_evento) : null;
                  const esHoy = dia === diaHoy && item.mesNum === mesHoy && item.anioNum === anioHoy;
                  const esSeleccionado = dia === diaSeleccionado && item.mesNum === mesSeleccionado && item.anioNum === anioSeleccionado;
                  const esPasado = esFechaPasada(item.anioNum, item.mesNum, dia);

                  return (
                    <TouchableOpacity
                      key={`ext-${item.key}-${dia}`}
                      style={[
                        estilos.celdaExtendido,
                        esHoy && estilos.celdaExtendidoHoy,
                        esSeleccionado && estilos.celdaExtendidoSeleccionada,
                        esPasado && estilos.celdaExtendidoPasada,
                      ]}
                      onPress={() => {
                        setDiaSeleccionado(dia);
                        setMesSeleccionado(item.mesNum);
                        setAnioSeleccionado(item.anioNum);
                      }}
                    >
                      <Text
                        style={[
                          estilos.textoDiaExtendido,
                          esPasado && estilos.textoDiaPasado,
                          tieneEvento && { color: colorEvento, fontWeight: 'bold' },
                          esHoy && estilos.textoDiaExtendidoHoy,
                        ]}
                      >
                        {dia}
                      </Text>

                      {tieneEvento && (
                        <View
                          style={[
                            estilos.indicadorColorEvento,
                            { backgroundColor: colorEvento },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {contieneSeleccion && renderDetalleFecha(`${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`)}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const registrosDelDiaSeleccionado = registrosDeFecha(`${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`);
  const esDiaSeleccionadoPasado = esFechaPasada(anioSeleccionado, mesSeleccionado, diaSeleccionado);
  const fechaHoyISO = formatearFechaISO(fechaActual);
  const horariosCuidadoDeHoy = horariosCuidado.filter(
    (turno) => String(turno.fecha_inicio || '').split('T')[0] === fechaHoyISO
  );
  const horariosMedicamentosDeHoy = horariosMedicamentos.filter(
    (toma) => String(toma.fecha_inicio || '').split('T')[0] === fechaHoyISO
  );

  if (mostrarCalendarioExtendido) {
    return (
      <SafeAreaView style={estilos.contenedorExtendido}>
        <View style={estilos.barraSuperiorExtendido}>
          <TouchableOpacity
            style={estilos.botonCircularRegreso}
            onPress={() => setMostrarCalendarioExtendido(false)}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={estilos.contenedorBuscador}>
            <Feather name="search" size={20} color="#2B5B66" style={estilos.iconoBusqueda} />
            <TextInput
              style={estilos.inputBuscador}
              placeholder="Buscar..."
              placeholderTextColor="#7E9A98"
              value={busqueda}
              onChangeText={setBusqueda}
            />
            <TouchableOpacity
              style={estilos.botonCircularMas}
              onPress={() => abrirModalGestion(`${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={estilos.contenedorEncabezadoFijo}>
          <View style={estilos.filaMesAnioPrincipal}>
            <Text style={estilos.tituloPrincipalExtendido}>{mesEnVista}</Text>
            <Text style={estilos.anioPrincipalExtendido}>{anioEnVista}</Text>
          </View>

          <View style={estilos.filaSemanaExtendido}>
            {diasSemanaExtendido.map((d, i) => (
              <Text key={`header-ext-${i}`} style={estilos.textoSemanaExtendido}>
                {d}
              </Text>
            ))}
          </View>
          <View style={estilos.lineaSeparadoraSemana} />
        </View>

        <FlatList
          data={listaMeses}
          keyExtractor={(item) => item.key}
          renderItem={renderItemMes}
          contentContainerStyle={estilos.listaMesesContenido}
          showsVerticalScrollIndicator={false}
          onEndReached={cargarMasMesesProgresivo}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListFooterComponent={
            <View style={{ display: 'none' }}>
              <View style={estilos.tarjetaDetalleDia}>
                <View style={estilos.cabeceraDetalleDia}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.tituloDetalleDia}>
                      Eventos para el {diaSeleccionado} de {NOMBRES_MESES[mesSeleccionado - 1]} de {anioSeleccionado}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      estilos.botonAgregarEventoDia,
                      esDiaSeleccionadoPasado && { opacity: 0.35 },
                    ]}
                    onPress={() => {
                      if (esDiaSeleccionadoPasado) {
                        Alert.alert('Fecha pasada', 'No se pueden programar horarios en fechas anteriores a la actual.');
                        return;
                      }
                      const f = `${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`;
                      abrirModalGestion(f);
                    }}
                  >
                    <Feather name="plus-circle" size={18} color="#3B7A8C" />
                    <Text style={estilos.textoAgregarEventoDia}>Gestionar Horario</Text>
                  </TouchableOpacity>
                </View>

                {registrosDelDiaSeleccionado.length === 0 ? (
                  <Text style={estilos.textoSinEventos}>No hay registros para este día.</Text>
                ) : (
                  registrosDelDiaSeleccionado.map((registro) => {
                    return (
                      <TouchableOpacity key={`${registro.tipo}-${registro.id_evento || registro.id_horario_cuidado || registro.id_medicamento}`} style={estilos.itemEventoDetalle} onPress={() => abrirDetalleRegistro(registro)}>
                        <View style={[estilos.puntoColorEvento, { backgroundColor: registro.tipo === 'evento' ? '#38b6ff' : registro.tipo === 'turno' ? '#c1ff72' : '#ffde59' }]} />
                        <View style={estilos.infoEventoDetalle}>
                          <Text style={estilos.tipoRegistro}>{registro.tipo.toUpperCase()}</Text>
                          <Text style={estilos.nombreEventoDetalle}>{registro.titulo}</Text>
                          <Text style={estilos.horaEventoDetalle}>Hora: {String(registro.hora || '').substring(0, 5)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          }
        />

        <Modal
          visible={modalDetalleRegistro}
          transparent
          animationType="fade"
          onRequestClose={() => setModalDetalleRegistro(false)}
        >
          <View style={estilos.fondoModal}>
            <View style={estilos.tarjetaModalForm}>
              <View style={estilos.cabeceraModalForm}>
                <Text style={estilos.tituloModalForm}>Detalle del {registroSeleccionado?.tipo}</Text>
                <TouchableOpacity onPress={() => setModalDetalleRegistro(false)}>
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={estilos.detalleRegistroTitulo}>{registroSeleccionado?.titulo}</Text>
              <Text style={estilos.detalleRegistroTexto}>Hora: {String(registroSeleccionado?.hora || '').substring(0, 5)}</Text>
              <View style={estilos.filaBotonesForm}>
                <TouchableOpacity style={estilos.botonCancelarForm} onPress={eliminarRegistro}>
                  <Text style={estilos.textoEliminarRegistro}>Eliminar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={estilos.botonGuardarForm} onPress={editarRegistro}>
                  <Text style={estilos.textoBotonGuardarForm}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={modalGestionHorario}
          transparent
          animationType="slide"
          onRequestClose={() => setModalGestionHorario(false)}
        >
          <View style={estilos.fondoModal}>
            <View style={estilos.tarjetaModalForm}>
              <View style={estilos.cabeceraModalForm}>
                <Text style={estilos.tituloModalForm}>Gestionar Horarios</Text>
                <TouchableOpacity onPress={() => setModalGestionHorario(false)}>
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={estilos.selectorTipoGestion}>
                <TouchableOpacity
                  style={[estilos.btnSelectorTipo, tipoGestion === 'cuidado' && estilos.btnSelectorActivo]}
                  onPress={() => setTipoGestion('cuidado')}
                >
                  <Text style={[estilos.txtSelectorTipo, tipoGestion === 'cuidado' && estilos.txtSelectorActivo]}>Turno Cuidado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[estilos.btnSelectorTipo, tipoGestion === 'medicamento' && estilos.btnSelectorActivo]}
                  onPress={() => setTipoGestion('medicamento')}
                >
                  <Text style={[estilos.txtSelectorTipo, tipoGestion === 'medicamento' && estilos.txtSelectorActivo]}>Medicamento</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[estilos.btnSelectorTipo, tipoGestion === 'evento' && estilos.btnSelectorActivo]}
                  onPress={() => setTipoGestion('evento')}
                >
                  <Text style={[estilos.txtSelectorTipo, tipoGestion === 'evento' && estilos.txtSelectorActivo]}>Evento</Text>
                </TouchableOpacity>
              </View>

              {errorFormulario ? <Text style={estilos.errorFormulario}>{errorFormulario}</Text> : null}

              {tipoGestion === 'cuidado' ? (
                <>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Encargado(s) *</Text>
                    {cuidadoresDisponibles.length === 0 ? (
                      <Text style={estilos.textoSinCuidadores}>No hay cuidadores disponibles en este grupo.</Text>
                    ) : (
                      cuidadoresDisponibles.map((cuidador) => (
                        <TouchableOpacity
                          key={cuidador.id_usuario}
                          style={[estilos.opcionCuidador, Number(encargadoCuidado) === cuidador.id_usuario && estilos.opcionCuidadorActiva]}
                          onPress={() => setEncargadoCuidado(cuidador.id_usuario.toString())}
                        >
                          <Text style={estilos.textoOpcionCuidador}>{cuidador.nombre}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Hora Inicio (HH:MM) *</Text>
                    <TextInput
                      style={[estilos.inputForm, estilos.inputHora]}
                      value={horaInicioCuidado}
                      onChangeText={setHoraInicioCuidado}
                      placeholder="08:00"
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Hora Fin (HH:MM) *</Text>
                    <TextInput
                      style={[estilos.inputForm, estilos.inputHora]}
                      value={horaFinCuidado}
                      onChangeText={setHoraFinCuidado}
                      placeholder="16:00"
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Fecha de Inicio (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      value={fechaFormulario}
                      onChangeText={setFechaFormulario}
                      placeholder="2026-09-07"
                    />
                  </View>

                  {/* Retroalimentación visual dinámica de fecha de inicio a fecha de fin */}
                  {(() => {
                    try {
                      const { fin, diffHoras } = calcularFechasTurno();
                      const fechaFinVisual = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
                      return (
                        <View style={estilos.retroalimentaciónTurno}>
                          <Text style={estilos.textoRetroalimentacion}>
                            📅 Turno desde: <Text style={{ fontWeight: 'bold' }}>{fechaFormulario} {horaInicioCuidado}</Text>
                          </Text>
                          <Text style={estilos.textoRetroalimentacion}>
                            🏁 Turno hasta: <Text style={{ fontWeight: 'bold' }}>{fechaFinVisual} {horaFinCuidado}</Text>
                          </Text>
                          {diffHoras > 24 && (
                            <Text style={{ color: '#D32F2F', fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                              ⚠️ El turno excede las 24 horas permitidas.
                            </Text>
                          )}
                        </View>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}
                </>
              ) : tipoGestion === 'medicamento' ? (
                <>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Nombre del Medicamento *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      placeholder="Ej. Paracetamol"
                      value={nombreMed}
                      onChangeText={setNombreMed}
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Dosis *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      placeholder="Ej. 1 mgr o 1 cc"
                      value={dosisMed}
                      onChangeText={setDosisMed}
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Presentación *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      placeholder="Ej. Pastilla, Jarabe..."
                      value={presentacionMed}
                      onChangeText={setPresentacionMed}
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Hora de Toma (HH:MM) *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      placeholder="16:00"
                      value={horaTomaMed}
                      onChangeText={setHoraTomaMed}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Nombre del evento *</Text>
                    <TextInput style={estilos.inputForm} placeholder="Ej. Cita médica" value={nombreEvento} onChangeText={setNombreEvento} />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Fecha (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={estilos.inputForm}
                      value={fechaEvento}
                      onChangeText={setFechaEvento}
                      placeholder="2026-09-07"
                    />
                  </View>
                  <View style={estilos.grupoInputForm}>
                    <Text style={estilos.labelForm}>Hora (HH:MM) *</Text>
                    <TextInput style={[estilos.inputForm, estilos.inputHora]} placeholder="16:00" value={horaEvento} onChangeText={setHoraEvento} keyboardType="numeric" />
                  </View>
                  <Text style={estilos.fechaSeleccionada}>Fecha seleccionada: {fechaEvento}</Text>
                </>
              )}

              <View style={estilos.filaBotonesForm}>
                <TouchableOpacity
                  style={estilos.botonCancelarForm}
                  onPress={() => setModalGestionHorario(false)}
                  disabled={guardandoHorario}
                >
                  <Text style={estilos.textoBotonCancelarForm}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={estilos.botonGuardarForm}
                  onPress={manejarGuardarHorario}
                  disabled={guardandoHorario}
                >
                  {guardandoHorario ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={estilos.textoBotonGuardarForm}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const nombreEventoPequeno = obtenerEventoPequenoDinamico();

  return (
    <SafeAreaView style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.contenidoScroll}>
        <View style={estilos.tarjetaCalendario}>
          <TouchableOpacity
            style={estilos.botonIconoEditar}
            onPress={() => setMostrarCalendarioExtendido(true)}
            activeOpacity={0.7}
          >
            <Feather name="edit-3" size={14} color="#FFF" />
          </TouchableOpacity>

          <View style={estilos.contenedorHorizontalCard}>
            <View style={estilos.seccionIzquierda}>
              <Text style={estilos.textoHoy}>{textoDiaHoy}</Text>
              <Text style={estilos.textoNumeroSeleccionado}>{diaHoy}</Text>

              {nombreEventoPequeno && (
                <View style={estilos.etiquetaCita}>
                  <Text style={estilos.textoCita} numberOfLines={2}>
                    {nombreEventoPequeno}
                  </Text>
                </View>
              )}
            </View>

            <View style={estilos.seccionCalendario}>
              <View style={estilos.encabezadoMes}>
                <Text style={estilos.textoMes}>{NOMBRES_MESES[mesHoy - 1].toUpperCase()}</Text>
                <Text style={estilos.textoAnio}>{anioHoy}</Text>
              </View>

              <View style={estilos.mallaDiasSemana}>
                {diasSemanaPequeno.map((d, i) => (
                  <Text key={i} style={estilos.textoHeaderDia}>{d}</Text>
                ))}
              </View>

              <View style={estilos.mallaDiasNumeros}>
                {renderDiasCalendarioPequeno()}
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={estilos.botonEditarPrincipal}
          onPress={() => setMostrarCalendarioExtendido(true)}
        >
          <Text style={estilos.textoBotonEditar}>EDITAR HORARIO</Text>
          <Feather name="edit-2" size={16} color="#FFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {horariosCuidadoDeHoy.length > 0 ? (
          horariosCuidadoDeHoy.map((turno, idx) => (
            <View key={`turno-${idx}`}>
              <Text style={estilos.textoMarcadorTurno}>
                ------- INICIO: {turno.encargado?.toUpperCase()} - {turno.hora_inicio} -------
              </Text>
            </View>
          ))
        ) : (
          <Text style={estilos.textoMarcadorTurno}>------- NO HAY TURNOS REGISTRADOS -------</Text>
        )}

        {horariosMedicamentosDeHoy.length > 0 ? (
          horariosMedicamentosDeHoy.map((bloque, idx) => (
            <View key={`med-bloque-${idx}`} style={estilos.bloqueHorario}>
              <View style={estilos.columnaMedicamentos}>
                <View style={estilos.tarjetaMedicamento}>
                  <Text style={estilos.nombreMedicamento}>{bloque.nombre_medicamento}:</Text>
                  <Text style={estilos.dosisMedicamento}>{bloque.dosis} ({bloque.presentacion})</Text>
                </View>
              </View>
              <View style={estilos.piscinaHora}>
                <Text style={estilos.textoHora}>{bloque.hora_toma}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={{ padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#777', fontStyle: 'italic' }}>No hay medicamentos registrados en este horario.</Text>
          </View>
        )}

        {horariosCuidadoDeHoy.length > 0 && (
          horariosCuidadoDeHoy.map((turno, idx) => (
            <View key={`fin-${idx}`}>
              <Text style={estilos.textoMarcadorTurno}>
                ------- FIN: {turno.encargado?.toUpperCase()} - {turno.hora_fin} -------
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  contenidoScroll: { padding: 16, paddingBottom: 40 },
  tarjetaCalendario: {
    backgroundColor: '#A8D8D0',
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    marginBottom: 16,
  },
  botonIconoEditar: {
    alignSelf: 'flex-end',
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 6,
    marginBottom: 4,
  },
  contenedorHorizontalCard: { flexDirection: 'row', justifyContent: 'space-between' },
  seccionIzquierda: { width: '38%', justifyContent: 'flex-start', paddingTop: 8, paddingLeft: 7 },
  textoHoy: { fontSize: 11, fontWeight: 'bold', color: '#111' },
  textoNumeroSeleccionado: { fontSize: 28, fontWeight: 'bold', color: '#111', marginVertical: 4 },
  etiquetaCita: {
    backgroundColor: '#B5F062',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  textoCita: { fontSize: 10, fontWeight: '600', color: '#000', textAlign: 'center' },
  seccionCalendario: { width: '60%', paddingTop: 4, paddingRight: 10 },
  encabezadoMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  textoMes: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  textoAnio: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  mallaDiasSemana: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  textoHeaderDia: { width: '13%', textAlign: 'center', fontSize: 9, fontWeight: 'bold', color: '#444' },
  mallaDiasNumeros: { flexDirection: 'row', flexWrap: 'wrap' },
  celdaDia: {
    width: '14.28%',
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    marginBottom: 2,
  },
  diaHoy: { backgroundColor: '#B5F062' },
  textoDiaNumero: { fontSize: 10, color: '#222', fontWeight: '500' },
  textoDiaResaltado: { fontWeight: 'bold', color: '#000' },
  botonEditarPrincipal: {
    backgroundColor: '#6b6b6b',
    borderRadius: 20,
    paddingVertical: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  textoBotonEditar: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  textoMarcadorTurno: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#3B7A8C', marginVertical: 6 },
  bloqueHorario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  columnaMedicamentos: { width: '60%' },
  tarjetaMedicamento: { backgroundColor: '#EAEAEA', borderRadius: 12, padding: 10, marginBottom: 8, alignItems: 'center' },
  nombreMedicamento: { fontSize: 13, fontWeight: 'bold', color: '#000' },
  dosisMedicamento: { fontSize: 12, fontWeight: '600', color: '#000' },
  piscinaHora: { backgroundColor: '#60A5A3', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, width: '35%', alignItems: 'center' },
  textoHora: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  contenedorExtendido: { flex: 1, backgroundColor: '#FFFFFF' },
  barraSuperiorExtendido: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  botonCircularRegreso: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#60A5A3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contenedorBuscador: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F2',
    borderRadius: 25,
    paddingHorizontal: 12,
    height: 48,
  },
  iconoBusqueda: { marginRight: 8 },
  inputBuscador: { flex: 1, fontSize: 15, color: '#111' },
  botonCircularMas: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#60A5A3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contenedorEncabezadoFijo: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  filaMesAnioPrincipal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  tituloPrincipalExtendido: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
  },
  anioPrincipalExtendido: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555555',
  },
  filaSemanaExtendido: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  textoSemanaExtendido: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
  },
  lineaSeparadoraSemana: {
    height: 1,
    backgroundColor: '#B0C4DE',
    marginBottom: 8,
  },
  listaMesesContenido: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  seccionMesExtendido: { marginBottom: 20 },
  filaTituloMesAnio: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tituloMesSeccion: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3B7A8C',
  },
  tituloAnioSeccion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  cuadriculaDias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 6,
  },
  filaSemanaCalendario: { width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  celdaExtendidoVacia: { width: '14.28%', height: 40 },
  celdaExtendido: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  celdaExtendidoPasada: { opacity: 0.6 },
  celdaExtendidoHoy: {
    backgroundColor: '#DDF4F0',
    borderRadius: 20,
  },
  celdaExtendidoSeleccionada: {
    borderWidth: 1.5,
    borderColor: '#3B7A8C',
    borderRadius: 20,
  },
  textoDiaExtendido: { fontSize: 13, color: '#333', fontWeight: '500' },
  textoDiaExtendidoHoy: { color: '#008B8B', fontWeight: 'bold' },
  textoDiaPasado: { color: '#A0A0A0' },
  indicadorColorEvento: {
    width: 14,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
  },
  tarjetaDetalleDia: {
    backgroundColor: '#F9FBFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0ECE9',
    padding: 16,
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
  },
  cabeceraDetalleDia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tituloDetalleDia: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  botonAgregarEventoDia: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoAgregarEventoDia: { fontSize: 13, color: '#3B7A8C', fontWeight: '600' },
  textoSinEventos: { fontSize: 13, color: '#777', fontStyle: 'italic', marginVertical: 6 },
  itemEventoDetalle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  puntoColorEvento: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  infoEventoDetalle: { flex: 1 },
  nombreEventoDetalle: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  horaEventoDetalle: { fontSize: 12, color: '#666', marginTop: 2 },
  tipoRegistro: { fontSize: 10, fontWeight: '700', color: '#3B7A8C', marginBottom: 2 },
  detalleRegistroTitulo: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  detalleRegistroTexto: { fontSize: 14, color: '#555', marginBottom: 18 },
  textoEliminarRegistro: { color: '#D32F2F', fontSize: 14, fontWeight: '600' },

  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tarjetaModalForm: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    elevation: 10,
  },
  cabeceraModalForm: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tituloModalForm: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  selectorTipoGestion: {
    flexDirection: 'row',
    backgroundColor: '#EEE',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  btnSelectorTipo: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  btnSelectorActivo: {
    backgroundColor: '#60A5A3',
  },
  txtSelectorTipo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  txtSelectorActivo: {
    color: '#FFF',
  },
  errorFormulario: {
    backgroundColor: '#FFEBEE',
    color: '#D32F2F',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  grupoInputForm: { marginBottom: 14 },
  labelForm: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 5 },
  textoSinCuidadores: { color: '#777', fontSize: 13, fontStyle: 'italic' },
  opcionCuidador: { borderWidth: 1, borderColor: '#CCC', borderRadius: 10, padding: 10, marginBottom: 7, backgroundColor: '#FAFAFA' },
  opcionCuidadorActiva: { borderColor: '#60A5A3', backgroundColor: '#E8F4F2' },
  textoOpcionCuidador: { color: '#333', fontSize: 14 },
  fechaSeleccionada: { color: '#3B7A8C', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  inputForm: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  inputHora: { color: '#777777' },
  filaBotonesForm: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  botonCancelarForm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#999',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  textoBotonCancelarForm: { color: '#666', fontSize: 14, fontWeight: '600' },
  botonGuardarForm: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#60A5A3',
    alignItems: 'center',
  },
  textoBotonGuardarForm: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  retroalimentaciónTurno: {
    backgroundColor: '#E8F4F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#60A5A3',
  },
  textoRetroalimentacion: {
    fontSize: 12,
    color: '#2B5B66',
    marginBottom: 2,
  }
});
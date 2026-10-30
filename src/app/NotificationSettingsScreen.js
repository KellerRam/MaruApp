import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../config/api';
import FormPickerInput from '../components/ui/FormPickerInput';
import { apiFetch as fetch } from '../config/apiFetch';

// Umbral de fuerza (en g, restando la gravedad) para considerar una sacudida "muy brusca"
const UMBRAL_SACUDIDA = 2.6;
const LECTURAS_CONSECUTIVAS_REQUERIDAS = 3;
const VENTANA_LECTURAS_MS = 900;
const ENFRIAMIENTO_MS = 15000;

const HORARIOS_PREDETERMINADOS = ['08:00', '12:00', '16:00', '19:00', '22:00'];
const MAXIMO_ALERTAS_BIENESTAR = 5;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const montadaRef = useRef(false);
  
  const [alertaBienestar, setAlertaBienestar] = useState(false);
  const [expandidoBienestar, setExpandidoBienestar] = useState(false);
  const [horariosBienestar, setHorariosBienestar] = useState([HORARIOS_PREDETERMINADOS[0]]);
  const [esPaciente, setEsPaciente] = useState(true);

  const [recordatoriosMeds, setRecordatoriosMeds] = useState(false);
  const [expandidoMeds, setExpandidoMeds] = useState(false);

  const [expandidoPermisos, setExpandidoPermisos] = useState(false);

  const [eventosProximos, setEventosProximos] = useState(false);
  const [expandidoEventos, setExpandidoEventos] = useState(false);

  const [emergencia, setEmergencia] = useState(true);
  const [expandidoEmergencia, setExpandidoEmergencia] = useState(false);

  useEffect(() => {
    montadaRef.current = true;
    return () => { montadaRef.current = false; };
  }, []);

  // Cargar estado inicial desde el backend
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const idUsuario = await AsyncStorage.getItem('userId');
        if (!idUsuario || !montadaRef.current) return;

        const respuesta = await fetch(`${API_URL}/api/notifications/preferences/${idUsuario}`);
        if (!montadaRef.current) return;
        if (respuesta.ok) {
          const datos = await respuesta.json();
          if (!montadaRef.current) return;
          setAlertaBienestar(datos.confirmacion_bienestar || false);
          if (Array.isArray(datos.horarios) && datos.horarios.length > 0) setHorariosBienestar(datos.horarios);
        } else if (respuesta.status === 404) {
          setEsPaciente(false); // solo el paciente del grupo configura esta alerta
        }
      } catch (error) {
        if (montadaRef.current) console.error('Error al cargar preferencias:', error);
      }
    };
    cargarConfiguracion();
  }, []);

  // Los toques sobre las notificaciones de bienestar y medicamentos se atienden en utils/notificacionesCliente.js

  // Detección de sacudida muy brusca mediante el acelerómetro (requiere varias lecturas
  // consecutivas por encima del umbral para evitar falsos positivos con movimientos normales).
  // Nota: en apps administradas por Expo (Expo Go o incluso development build) la detección solo
  // funciona mientras el proceso de JS siga vivo (primer plano o segundo plano reciente); una vez
  // el sistema operativo mata la app o el dispositivo está bloqueado por mucho tiempo, se requeriría
  // un módulo nativo con servicio en segundo plano (fuera del alcance de Expo managed).
  useEffect(() => {
    let subscription = null;

    if (emergencia) {
      let ultimaActualizacion = 0;
      let lecturasRecientes = [];
      let ultimoDisparo = 0;

      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const ahora = Date.now();
        if (ahora - ultimaActualizacion < 90) return;
        ultimaActualizacion = ahora;

        const magnitud = Math.sqrt(x * x + y * y + z * z);
        const fuerzaNeta = Math.abs(magnitud - 1); // resta la gravedad (~1g en reposo)

        lecturasRecientes = lecturasRecientes.filter((t) => ahora - t < VENTANA_LECTURAS_MS);
        if (fuerzaNeta > UMBRAL_SACUDIDA) {
          lecturasRecientes.push(ahora);
        }

        if (lecturasRecientes.length >= LECTURAS_CONSECUTIVAS_REQUERIDAS && ahora - ultimoDisparo > ENFRIAMIENTO_MS) {
          ultimoDisparo = ahora;
          lecturasRecientes = [];
          dispararEmergenciaPorAgitacion();
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [emergencia]);

  const dispararEmergenciaPorAgitacion = async () => {
    try {
      const idGrupo = await AsyncStorage.getItem('groupId');
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idGrupo || !idUsuario) return;

      // Envía alerta al chat o endpoint de emergencia del backend igual que el botón principal
      const respuesta = await fetch(`${API_URL}/api/emergency/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_grupo: idGrupo, id_usuario: idUsuario, motivo: 'Agitación brusca detectada por sensor' }),
      });
      if (!respuesta.ok) throw new Error('El servidor no pudo registrar la emergencia');
      if (!montadaRef.current) return;

      Alert.alert('¡Alerta de Emergencia!', 'Se ha detectado un movimiento brusco. Se ha notificado al grupo y cuidadores.');
    } catch (error) {
      console.error('Error al disparar emergencia automática:', error);
    }
  };

  const guardarPreferenciasBienestar = async (valor, horarios) => {
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) return false;

      const respuesta = await fetch(`${API_URL}/api/notifications/bienestar/${idUsuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacion_bienestar: valor, horarios }),
      });
      if (!respuesta.ok) throw new Error('No se pudieron guardar las preferencias de bienestar');
      return true;
    } catch (error) {
      console.error('Error al actualizar confirmacion_bienestar:', error);
      return false;
    }
  };

  const guardarConfirmacionBienestar = async (valor) => {
    if (!esPaciente) {
      Alert.alert('Solo para el paciente', 'La alerta de bienestar la configura el paciente del grupo desde su propio dispositivo.');
      return;
    }
    const guardado = await guardarPreferenciasBienestar(valor, horariosBienestar);
    if (!guardado) {
      Alert.alert('Error', 'No se pudo guardar la preferencia de bienestar.');
      return;
    }
    setAlertaBienestar(valor);
    if (!valor) setExpandidoBienestar(false);
  };

const registrarTokenPush = async () => {
    try {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) return;

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        console.warn('No hay projectId de EAS configurado: no se puede obtener el token de push de Expo.');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const respuesta = await fetch(`${API_URL}/api/notifications/push-token/${idUsuario}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: token }),
      });
      if (!respuesta.ok) throw new Error('El servidor rechazó el token push');
    } catch (error) {
      console.warn('No se pudo registrar el token push:', error.message);
    }
  };

const solicitarPermisosNotificacion = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
            allowCriticalAlerts: true,
            allowDisplayInCarPlay: true,
            allowProvisional: false,
          },
          android: {},
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permisos necesarios',
          'Para recibir alertas de bienestar, medicamentos y emergencias, debes habilitar las notificaciones (incluyendo alertas urgentes) en la configuración de tu dispositivo.'
        );
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergencias-canal', {
          name: 'Alertas de Emergencia y Bienestar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      await registrarTokenPush();

      Alert.alert(
        '¡Éxito!',
        'Los permisos de notificaciones (alertas, urgentes y sonido) han sido concedidos. Nota: para que las alertas lleguen con la app cerrada o el dispositivo bloqueado, la app debe instalarse como development/production build (no funciona con notificaciones push en Expo Go para Android).'
      );
      setExpandidoPermisos(false);
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error al solicitar los permisos de notificación.');
      console.error(error);
    }
  };

  const aplicarHorarios = async (nuevosHorarios) => {
    const ordenados = [...nuevosHorarios].sort();
    const guardado = await guardarPreferenciasBienestar(alertaBienestar, ordenados);
    if (!guardado) {
      Alert.alert('Error', 'No se pudieron guardar las horas de la alerta de bienestar.');
      return;
    }
    setHorariosBienestar(ordenados);
  };

  const cambiarFrecuencia = async (incremento) => {
    if (incremento < 0) {
      if (horariosBienestar.length > 1) await aplicarHorarios(horariosBienestar.slice(0, -1));
      return;
    }
    if (horariosBienestar.length >= MAXIMO_ALERTAS_BIENESTAR) return;
    const nueva = HORARIOS_PREDETERMINADOS.find((hora) => !horariosBienestar.includes(hora));
    if (nueva) await aplicarHorarios([...horariosBienestar, nueva]);
  };

  const cambiarHoraBienestar = async (indice, nuevaHora) => {
    if (!nuevaHora || nuevaHora === horariosBienestar[indice]) return;
    if (horariosBienestar.some((hora, i) => i !== indice && hora === nuevaHora)) {
      Alert.alert('Hora repetida', 'Ya existe una alerta de bienestar a esa hora.');
      return;
    }
    await aplicarHorarios(horariosBienestar.map((hora, i) => (i === indice ? nuevaHora : hora)));
  };

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      
      <View style={estilos.encabezado}> 
        <TouchableOpacity style={estilos.botonCerrar} onPress={() => router.push('/(tabs)')}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
      </View>

      {/* ALERTA DE BIENESTAR */}
      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>ALERTA DE BIENESTAR</Text>
          <View style={estilos.contenedorControles}>
            <Switch
              trackColor={{ false: '#767577', true: '#0A3D4C' }}
              thumbColor={'#f4f3f4'}
              value={alertaBienestar}
              onValueChange={guardarConfirmacionBienestar}
            />
            <TouchableOpacity 
              disabled={!alertaBienestar}
              onPress={() => setExpandidoBienestar(!expandidoBienestar)}
              style={[estilos.botonFlecha, !alertaBienestar && estilos.opcionBloqueada]}
            >
              <Feather 
                name={expandidoBienestar ? "chevron-up" : "chevron-down"} 
                size={22} 
                color={alertaBienestar ? "#111" : "#AAA"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {expandidoBienestar && alertaBienestar && (
          <View style={estilos.subOpciones}>
            <Text style={estilos.subTextoLabel}>Alertas al día (máx. 5). Elige la hora de cada una:</Text>
            <View style={estilos.filaFrecuencia}>
              <TouchableOpacity style={estilos.btnContador} onPress={() => cambiarFrecuencia(-1)}>
                <Text style={estilos.txtContador}>-</Text>
              </TouchableOpacity>
              <Text style={estilos.valorFrecuencia}>{horariosBienestar.length}</Text>
              <TouchableOpacity style={estilos.btnContador} onPress={() => cambiarFrecuencia(1)}>
                <Text style={estilos.txtContador}>+</Text>
              </TouchableOpacity>
            </View>

            {horariosBienestar.map((hora, index) => (
              <View key={`${index}-${hora}`} style={estilos.cajaHora}>
                <Text style={estilos.txtHoraLabel}>Alerta {index + 1}:</Text>
                <FormPickerInput
                  pickerType="time"
                  modalTitle={`Hora de la alerta ${index + 1}`}
                  style={estilos.selectorHora}
                  placeholder="HH:MM"
                  value={hora}
                  onChangeText={(nuevaHora) => cambiarHoraBienestar(index, nuevaHora)}
                />
              </View>
            ))}
            <Text style={estilos.subTextoLabel}>• Si no confirmas en 5 min, se avisa al grupo en el chat cada 5 min.</Text>
          </View>
        )}
      </View>

      {/* RECORDATORIOS DE MEDICAMENTOS */}
      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>RECORDATORIOS DE MEDICAMENTOS</Text>
          <View style={estilos.contenedorControles}>
            <Switch
              trackColor={{ false: '#767577', true: '#0A3D4C' }}
              thumbColor={'#f4f3f4'}
              value={recordatoriosMeds}
              onValueChange={(val) => {
                setRecordatoriosMeds(val);
                if (!val) setExpandidoMeds(false);
              }}
            />
            <TouchableOpacity 
              disabled={!recordatoriosMeds}
              onPress={() => setExpandidoMeds(!expandidoMeds)}
              style={[estilos.botonFlecha, !recordatoriosMeds && estilos.opcionBloqueada]}
            >
              <Feather name={expandidoMeds ? "chevron-up" : "chevron-down"} size={22} color={recordatoriosMeds ? "#111" : "#AAA"} />
            </TouchableOpacity>
          </View>
        </View>

        {expandidoMeds && recordatoriosMeds && (
          <View style={estilos.subOpciones}>
            <Text style={estilos.subTextoLabel}>• Anticipación de aviso: 15 minutos antes</Text>
            <Text style={estilos.subTextoLabel}>• Repetir si no hay confirmación: Cada 10 min</Text>
            <Text style={estilos.subTextoLabel}>• Cualquier miembro del grupo puede confirmar la toma</Text>
          </View>
        )}
      </View>

      {/* PERMISOS DE NOTIFICACIONES */}
      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>PERMISOS DE NOTIFICACIONES</Text>
          <TouchableOpacity 
            onPress={() => setExpandidoPermisos(!expandidoPermisos)}
            style={estilos.botonFlecha}
          >
            <Feather name={expandidoPermisos ? "chevron-up" : "chevron-down"} size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {expandidoPermisos && (
          <View style={estilos.subOpciones}>
            <TouchableOpacity style={estilos.botonPermiso} onPress={solicitarPermisosNotificacion}>
              <Text style={estilos.textoBotonPermiso}>Otorgar Permisos</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* RECORDATORIOS DE EVENTOS PRÓXIMOS */}
      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>RECORDATORIOS DE EVENTOS PRÓXIMOS</Text>
          <View style={estilos.contenedorControles}>
            <Switch
              trackColor={{ false: '#767577', true: '#0A3D4C' }}
              thumbColor={'#f4f3f4'}
              value={eventosProximos}
              onValueChange={(val) => {
                setEventosProximos(val);
                if (!val) setExpandidoEventos(false);
              }}
            />
            <TouchableOpacity 
              disabled={!eventosProximos}
              onPress={() => setExpandidoEventos(!expandidoEventos)}
              style={[estilos.botonFlecha, !eventosProximos && estilos.opcionBloqueada]}
            >
              <Feather name={expandidoEventos ? "chevron-up" : "chevron-down"} size={22} color={eventosProximos ? "#111" : "#AAA"} />
            </TouchableOpacity>
          </View>
        </View>

        {expandidoEventos && eventosProximos && (
          <View style={estilos.subOpciones}>
            <Text style={estilos.subTextoLabel}>• Avisar 1 hora antes de la cita</Text>
            <Text style={estilos.subTextoLabel}>• Incluir eventos del calendario compartido</Text>
          </View>
        )}
      </View>

      {/* NOTIFICACIONES DE EMERGENCIA */}
      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>NOTIFICACIONES DE EMERGENCIA</Text>
          <View style={estilos.contenedorControles}>
            <Switch
              trackColor={{ false: '#767577', true: '#0A3D4C' }}
              thumbColor={'#f4f3f4'}
              value={emergencia}
              onValueChange={(val) => {
                setEmergencia(val);
                if (!val) setExpandidoEmergencia(false);
              }}
            />
            <TouchableOpacity 
              disabled={!emergencia}
              onPress={() => setExpandidoEmergencia(!expandidoEmergencia)}
              style={[estilos.botonFlecha, !emergencia && estilos.opcionBloqueada]}
            >
              <Feather name={expandidoEmergencia ? "chevron-up" : "chevron-down"} size={22} color={emergencia ? "#111" : "#AAA"} />
            </TouchableOpacity>
          </View>
        </View>

        {expandidoEmergencia && emergencia && (
          <View style={estilos.subOpciones}>
            <Text style={estilos.subTextoLabel}>• Alerta prioritaria para cuidadores</Text>
            <Text style={estilos.subTextoLabel}>• Sensor de movimiento por giroscopio activado</Text>
          </View>
        )}
      </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  botonCerrar: {
    padding: 6,
  },
  tarjetaSeccion: { backgroundColor: '#C8E8E2', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14 },
  filaPrincipal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textoTitulo: { fontSize: 13, fontWeight: 'bold', color: '#000000', flex: 1 },
  contenedorControles: { flexDirection: 'row', alignItems: 'center' },
  botonFlecha: { marginLeft: 12, padding: 4 },
  opcionBloqueada: { opacity: 0.4 },
  subOpciones: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#A8D8D0' },
  subTextoLabel: { fontSize: 13, color: '#333333', marginBottom: 6 },
  filaFrecuencia: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  btnContador: { backgroundColor: '#60A5A3', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  txtContador: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  valorFrecuencia: { marginHorizontal: 16, fontSize: 16, fontWeight: 'bold', color: '#000' },
  cajaHora: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 6 },
  txtHoraLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  selectorHora: { flex: 1, marginLeft: 12, marginBottom: 0, borderRadius: 8, backgroundColor: '#FFF' },
  botonPermiso: { backgroundColor: '#008B8B', borderRadius: 15, paddingVertical: 8, alignItems: 'center' },
  textoBotonPermiso: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  
  const [alertaBienestar, setAlertaBienestar] = useState(false);
  const [expandidoBienestar, setExpandidoBienestar] = useState(false);
  const [frecuenciaBienestar, setFrecuenciaBienestar] = useState(1);

  const [recordatoriosMeds, setRecordatoriosMeds] = useState(false);
  const [expandidoMeds, setExpandidoMeds] = useState(false);

  const [tonoNotif, setTonoNotif] = useState(false);
  const [expandidoTono, setExpandidoTono] = useState(false);

  const [permisosNotif, setPermisosNotif] = useState(true);
  const [expandidoPermisos, setExpandidoPermisos] = useState(false);

  const [eventosProximos, setEventosProximos] = useState(false);
  const [expandidoEventos, setExpandidoEventos] = useState(false);

  const [emergencia, setEmergencia] = useState(true);
  const [expandidoEmergencia, setExpandidoEmergencia] = useState(false);

  const cambiarFrecuencia = (incremento) => {
    const nuevaFrecuencia = frecuenciaBienestar + incremento;
    if (nuevaFrecuencia >= 1 && nuevaFrecuencia <= 5) {
      setFrecuenciaBienestar(nuevaFrecuencia);
    }
  };

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      
      <View style={estilos.encabezado}> 
        <TouchableOpacity style={estilos.botonCerrar} onPress={() => router.push('/(tabs)')}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>ALERTA DE BIENESTAR</Text>
          <View style={estilos.contenedorControles}>
            <Switch
              trackColor={{ false: '#767577', true: '#0A3D4C' }}
              thumbColor={'#f4f3f4'}
              value={alertaBienestar}
              onValueChange={(val) => {
                setAlertaBienestar(val);
                if (!val) setExpandidoBienestar(false);
              }}
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
            <Text style={estilos.subTextoLabel}>Frecuencia al día (Máx. 5):</Text>
            <View style={estilos.filaFrecuencia}>
              <TouchableOpacity style={estilos.btnContador} onPress={() => cambiarFrecuencia(-1)}>
                <Text style={estilos.txtContador}>-</Text>
              </TouchableOpacity>
              <Text style={estilos.valorFrecuencia}>{frecuenciaBienestar}</Text>
              <TouchableOpacity style={estilos.btnContador} onPress={() => cambiarFrecuencia(1)}>
                <Text style={estilos.txtContador}>+</Text>
              </TouchableOpacity>
            </View>

            {Array.from({ length: frecuenciaBienestar }).map((_, index) => (
              <View key={index} style={estilos.cajaHora}>
                <Text style={estilos.txtHoraLabel}>Alerta {index + 1}:</Text>
                <View style={estilos.selectorHoraFicticio}>
                  <Text style={estilos.txtHoraSeleccionada}>
                    {index === 0 ? '08:00 AM' : index === 1 ? '12:00 PM' : index === 2 ? '04:00 PM' : index === 3 ? '07:00 PM' : '10:00 PM'}
                  </Text>
                  <Feather name="clock" size={16} color="#555" />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

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
          </View>
        )}
      </View>

      <View style={estilos.tarjetaSeccion}>
        <View style={estilos.filaPrincipal}>
          <Text style={estilos.textoTitulo}>TONO DE NOTIFICACIONES</Text>
          <TouchableOpacity 
            onPress={() => setExpandidoTono(!expandidoTono)}
            style={estilos.botonFlecha}
          >
            <Feather name={expandidoTono ? "chevron-up" : "chevron-down"} size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {expandidoTono && (
          <View style={estilos.subOpciones}>
            <Text style={estilos.subTextoLabel}>• Sonido actual: Campana Suave</Text>
            <Text style={estilos.subTextoLabel}>• Vibración: Activada</Text>
          </View>
        )}
      </View>

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
            <TouchableOpacity style={estilos.botonPermiso} onPress={() => alert('Permisos de notificaciones push concedidos')}>
              <Text style={estilos.textoBotonPermiso}>Otorgar Permisos</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
            <Text style={estilos.subTextoLabel}>• Sonido de sirena alta permanente</Text>
          </View>
        )}
      </View>

    </ScrollView>
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
  selectorHoraFicticio: { flexDirection: 'row', alignItems: 'center' },
  txtHoraSeleccionada: { fontSize: 13, color: '#60A5A3', fontWeight: 'bold', marginRight: 6 },
  botonPermiso: { backgroundColor: '#008B8B', borderRadius: 15, paddingVertical: 8, alignItems: 'center' },
  textoBotonPermiso: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
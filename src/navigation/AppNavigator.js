import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importar Pantallas
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 1. Creamos el Layout del Navbar (Tabs)
function NavbarLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Oculta el encabezado superior por defecto
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Inicio') iconName = 'home';
          else if (route.name === 'Calendario') iconName = 'calendar';
          else if (route.name === 'Finanzas') iconName = 'file-text';
          else if (route.name === 'Grupo') iconName = 'users';

          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#008B8B',
        tabBarInactiveTintColor: '#777',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 70,
          paddingBottom: 10,
        }
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Calendario" component={CalendarScreen} />
      <Tab.Screen name="Grupo" component={GroupScreen} />
      <Tab.Screen name="Finanzas" component={FinancesScreen} />
    </Tab.Navigator>
  );
}

// 2. Creamos el Enrutador Principal (Stack)
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {/* El Navbar completo es la ruta principal */}
        <Stack.Screen name="MainTabs" component={NavbarLayout} />
        
        {/* El Chat está fuera del Navbar, por lo que ocupará toda la pantalla */}
        <Stack.Screen name="ChatGrupal" component={ChatScreen} />
        
      </Stack.Navigator>
    </NavigationContainer>
  );
}
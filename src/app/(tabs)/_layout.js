import { Feather } from '@expo/vector-icons';
import { Tabs, useNavigation, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';
import TutorialTour from '../../components/TutorialTour';

export default function TabsLayout() {
  const router = useRouter();
  const navigation = useNavigation();

  return (
    <>
    <TutorialTour />
    <Tabs
      screenOptions={{
        headerShown: true, 
        headerTitle: '',
        headerStyle: { backgroundColor: '#F5F5F5', elevation: 0, shadowOpacity: 0 },
        headerLeft: () => (
          <TouchableOpacity 
            style={estilos.botonMenu}
            onPress={() => navigation.openDrawer()} 
          >
            <Feather name="list" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: '#008B8B',
        tabBarInactiveTintColor: '#777',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 70,
          paddingBottom: 10,
        }
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> 
        }} 
      />
      
      <Tabs.Screen 
        name="chat" 
        options={{ 
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
          href: '/ChatScreen', 
        }}
      />

      <Tabs.Screen 
        name="CalendarScreen" 
        options={{ 
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="GroupScreen" 
        options={{ 
          title: 'Grupo',
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="FinancesScreen" 
        options={{ 
          title: 'Finanzas',
          tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} /> 
        }} 
      />
    </Tabs>
    </>
  );
}

const estilos = StyleSheet.create({
  botonMenu: {
    backgroundColor: '#60A5A3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  }
});
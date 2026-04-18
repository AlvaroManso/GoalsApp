import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import OnboardingScreen from '../screens/OnboardingScreen';
import CheckInScreen from '../screens/CheckInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TrackerScreen from '../screens/TrackerScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ChatScreen from '../screens/ChatScreen';
import HistoryScreen from '../screens/HistoryScreen';

import { RootStackParamList, BottomTabParamList } from '../types/navigation';
import { getDB } from '../db/database';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = '';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Chat" component={ChatScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = React.useState<keyof RootStackParamList>('Onboarding');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const db = getDB();
      const profile = db.getFirstSync('SELECT * FROM UserProfile LIMIT 1');
      if (profile) {
        const today = new Date().toISOString().split('T')[0];
        const checkin = db.getFirstSync('SELECT * FROM DailyCheckin WHERE date = ?', [today]);
        if (checkin) {
          setInitialRoute('MainTabs');
        } else {
          setInitialRoute('CheckIn');
        }
      } else {
        setInitialRoute('Onboarding');
      }
    } catch (error) {
      console.error('Error verificando estado inicial:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return null; // O un componente de Spinner
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#111827' }
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="CheckIn" component={CheckInScreen} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen 
          name="Tracker" 
          component={TrackerScreen} 
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

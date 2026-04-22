import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import OnboardingScreen from '../screens/OnboardingScreen';
import CheckInScreen from '../screens/CheckInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TrackerScreen from '../screens/TrackerScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ChatScreen from '../screens/ChatScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

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
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Plan' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Coach' }} />
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
    return null; // Exactamente igual que en f5aef7a
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#111827' } // Hardcoded dark background
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
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import CheckInScreen from '../screens/CheckInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TrackerScreen from '../screens/TrackerScreen';
import { RootStackParamList } from '../types/navigation';
import { getDB } from '../db/database';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          setInitialRoute('Dashboard');
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
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen 
          name="Tracker" 
          component={TrackerScreen} 
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

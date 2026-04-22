import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getTrainingPlanForDate } from '../db/trainingPlan';
import { getActivities } from '../db/activities';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
});

export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    return true;
  } else {
    console.log('Must use physical device for Push Notifications');
    return false;
  }
};

export const scheduleDailyReminders = async () => {
  const hasPermission = await registerForPushNotificationsAsync();
  if (!hasPermission) return;

  // Cancel all previously scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1. Morning Check-in Reminder (e.g., 8:00 AM every day)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌅 ¡Buenos días campeón/a!",
      body: "¿Cómo ha ido el descanso? Registra tu estado para adaptar tu plan de hoy al 100%.",
      data: { route: 'CheckIn' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  // 2. Training Reminder (e.g., 6:00 PM every day)
  // Note: Local notifications with dynamic content per day can be tricky.
  // We can schedule a generic reminder, or we can schedule specific notifications for the next 7 days.
  await scheduleNext7DaysTrainingReminders();
};

const scheduleNext7DaysTrainingReminders = async () => {
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const session = getTrainingPlanForDate(dateStr);
    
    if (session && session.activityType.toLowerCase() !== 'rest') {
      // Schedule at 18:00 (6 PM) for that specific date
      const triggerDate = new Date(targetDate);
      triggerDate.setHours(18, 0, 0, 0);
      
      // Only schedule if it's in the future
      if (triggerDate > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔥 ¡Tu momento del día!",
            body: `Hoy toca destruir la sesión de: ${session.activityType} (${session.durationMinutes} min). ¡Ponte las zapatillas y a por todas!`,
            data: { route: 'Dashboard', date: dateStr },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
      }
    }
  }
};

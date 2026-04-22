import { getDB } from '../db/database';
import { Activity } from '../db/activities';

export const injectMockActivities = () => {
  const db = getDB();
  const today = new Date();
  
  const mockActivities: Activity[] = [];
  
  // Inject activities for the last 5 days to create a streak
  for (let i = 1; i <= 5; i++) {
    const actDate = new Date(today);
    actDate.setDate(today.getDate() - i);
    
    mockActivities.push({
      date: actDate.toISOString(),
      durationMinutes: 45,
      distanceKm: 5.5,
      avgPace: '05:30',
      calories: 450,
      avgHR: 145,
      routeCoordinates: '[]',
      type: i % 2 === 0 ? 'Running' : 'Fuerza'
    });
  }

  // Inject activities for the previous week (Monday to Sunday) to populate the weekly summary
  const currentDayOfWeek = today.getDay() || 7;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - currentDayOfWeek);
  
  for (let i = 1; i <= 3; i++) { // 3 workouts last week
    const actDate = new Date(lastSunday);
    actDate.setDate(lastSunday.getDate() - (i * 2)); // Spread them out
    
    mockActivities.push({
      date: actDate.toISOString(),
      durationMinutes: 60,
      distanceKm: 8.0,
      avgPace: '05:15',
      calories: 600,
      avgHR: 155,
      routeCoordinates: '[]',
      type: 'Running'
    });
  }

  try {
    db.withTransactionSync(() => {
      // First, clear existing to avoid duplicates if called multiple times
      db.runSync('DELETE FROM ActivityHistory WHERE distanceKm > 0 OR calories > 0');
      
      const stmt = db.prepareSync(
        'INSERT INTO ActivityHistory (date, durationMinutes, distanceKm, avgPace, calories, avgHR, routeCoordinates, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );

      mockActivities.forEach(act => {
        stmt.executeSync([
          act.date,
          act.durationMinutes,
          act.distanceKm,
          act.avgPace,
          act.calories,
          act.avgHR,
          act.routeCoordinates,
          act.type
        ]);
      });
    });
    console.log('Mock activities injected successfully');
  } catch (error) {
    console.error('Error injecting mock activities:', error);
  }
};

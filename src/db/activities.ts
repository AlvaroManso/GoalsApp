import { getDB } from './database';

export interface Activity {
  id?: number;
  date: string;
  durationMinutes: number;
  distanceKm: number;
  avgPace: string;
  calories: number;
  avgHR: number;
  routeCoordinates: string; // Array stringified
  type?: string;
}

export const saveActivity = (activity: Activity) => {
  const db = getDB();
  try {
    db.runSync(
      'INSERT INTO ActivityHistory (date, durationMinutes, distanceKm, avgPace, calories, avgHR, routeCoordinates, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        activity.date,
        activity.durationMinutes,
        activity.distanceKm,
        activity.avgPace,
        activity.calories,
        activity.avgHR,
        activity.routeCoordinates,
        activity.type || 'Running'
      ]
    );
  } catch (error) {
    console.error('Error saving activity:', error);
    throw error;
  }
};

export const getActivities = (): Activity[] => {
  try {
    const db = getDB();
    return db.getAllSync<Activity>('SELECT * FROM ActivityHistory ORDER BY date DESC, id DESC');
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};

export const deleteActivityByDateAndType = (date: string, type: string) => {
  try {
    const db = getDB();
    // Use LIKE date% to match the date part of the ISO string
    db.runSync(
      'DELETE FROM ActivityHistory WHERE date LIKE ? AND type = ? AND distanceKm = 0',
      [`${date}%`, type]
    );
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
};

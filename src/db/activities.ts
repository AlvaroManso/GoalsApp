import { getDB } from './database';

export interface ActivityRecord {
  id?: number;
  date: string;
  durationMinutes: number;
  distanceKm: number;
  avgPace: string;
  calories: number;
  avgHR: number;
  routeCoordinates: string; // JSON string of { latitude, longitude }[]
}

export const saveActivity = (activity: ActivityRecord) => {
  try {
    const db = getDB();
    db.runSync(
      `INSERT INTO ActivityHistory 
      (date, durationMinutes, distanceKm, avgPace, calories, avgHR, routeCoordinates) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.date,
        activity.durationMinutes,
        activity.distanceKm,
        activity.avgPace,
        activity.calories,
        activity.avgHR,
        activity.routeCoordinates
      ]
    );
  } catch (error) {
    console.error('Error saving activity:', error);
    throw error;
  }
};

export const getActivities = (): ActivityRecord[] => {
  try {
    const db = getDB();
    return db.getAllSync<ActivityRecord>('SELECT * FROM ActivityHistory ORDER BY id DESC');
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};

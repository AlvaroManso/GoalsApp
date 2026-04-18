import { getDB } from './database';

export interface AppEvent {
  id?: number;
  type: string;     // '10k', 'Maratón', 'Fuerza', 'Hyrox'
  priority: string; // 'A', 'B', 'C'
  date: string;     // ISO String 'YYYY-MM-DD'
}

export const getEvents = (): AppEvent[] => {
  try {
    const db = getDB();
    return db.getAllSync<AppEvent>('SELECT * FROM Events ORDER BY date ASC');
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

export const addEvent = (event: AppEvent): void => {
  try {
    const db = getDB();
    db.runSync(
      'INSERT INTO Events (type, priority, date) VALUES (?, ?, ?)',
      [event.type, event.priority, event.date]
    );
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
};

export const deleteEvent = (id: number): void => {
  try {
    const db = getDB();
    db.runSync('DELETE FROM Events WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

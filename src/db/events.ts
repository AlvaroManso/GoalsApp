import { getDB } from './database';

export interface AppEvent {
  id?: number;
  type: string;
  description?: string;
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
      'INSERT INTO Events (type, description, priority, date) VALUES (?, ?, ?, ?)',
      [event.type, event.description || null, event.priority, event.date]
    );
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
};

export const updateEvent = (event: AppEvent): void => {
  if (!event.id) return;
  try {
    const db = getDB();
    db.runSync(
      'UPDATE Events SET type = ?, description = ?, priority = ?, date = ? WHERE id = ?',
      [event.type, event.description || null, event.priority, event.date, event.id]
    );
  } catch (error) {
    console.error('Error updating event:', error);
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

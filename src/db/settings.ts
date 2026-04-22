import { getDB } from './database';

export const getSetting = (key: string): string | null => {
  try {
    const db = getDB();
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM AppSettings WHERE key = ?', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
};

export const setSetting = (key: string, value: string): void => {
  const db = getDB();
  db.runSync(
    'INSERT INTO AppSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
};


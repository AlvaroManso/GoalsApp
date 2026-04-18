import * as SQLite from 'expo-sqlite';

export const getDB = () => {
  return SQLite.openDatabaseSync('hybrid_coach.db');
};

export const initDB = () => {
  try {
    const db = getDB();
    db.execSync(`
      CREATE TABLE IF NOT EXISTS UserProfile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        age INTEGER,
        weight REAL,
        maxHR INTEGER,
        restingHR INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS Events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        description TEXT,
        priority TEXT,
        date TEXT
      );

      CREATE TABLE IF NOT EXISTS DailyCheckin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        fatigue INTEGER,
        jointPain INTEGER
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

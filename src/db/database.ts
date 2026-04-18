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

      CREATE TABLE IF NOT EXISTS TrainingPlan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekNumber INTEGER,
        dayOfWeek INTEGER,
        date TEXT,
        activityType TEXT,
        durationMinutes INTEGER,
        targetHRZone TEXT,
        coachNotes TEXT,
        requiresGPS INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS ActivityHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        durationMinutes INTEGER,
        distanceKm REAL,
        avgPace TEXT,
        calories INTEGER,
        avgHR INTEGER,
        routeCoordinates TEXT
      );
    `);

    // Intentamos añadir la columna 'description' si la tabla ya existía de antes y no la tiene.
    try {
      db.execSync('ALTER TABLE Events ADD COLUMN description TEXT;');
    } catch (e) {
      // Ignoramos el error si la columna ya existe
    }

    // Migración 3: Añadir type a ActivityHistory si no existe
    try {
      db.execSync('ALTER TABLE ActivityHistory ADD COLUMN type TEXT DEFAULT "Running"');
    } catch (error) {
      // La columna ya existe
    }

    // Migración 4: Añadir gender a UserProfile si no existe
    try {
      db.execSync('ALTER TABLE UserProfile ADD COLUMN gender TEXT DEFAULT "Prefiero no responder"');
    } catch (error) {
      // La columna ya existe
    }

    // Migración 5: Añadir requiresGPS a TrainingPlan si no existe
    try {
      db.execSync('ALTER TABLE TrainingPlan ADD COLUMN requiresGPS INTEGER DEFAULT 1');
    } catch (error) {
      // La columna ya existe
    }

    console.log('Database and tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

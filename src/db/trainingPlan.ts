import { getDB } from './database';
import { PlanSession } from '../services/geminiService';

export const saveTrainingPlan = (plan: PlanSession[]) => {
  const db = getDB();
  
  try {
    // Limpiamos el plan anterior si existía para reemplazarlo por el nuevo
    db.runSync('DELETE FROM TrainingPlan');

    // Insertar cada día del plan
    // Para optimizar en SQLite, podríamos usar una transacción o batch, pero runSync es suficiente para ~364 filas en SQLite local
    const stmt = db.prepareSync(
      'INSERT INTO TrainingPlan (weekNumber, dayOfWeek, date, activityType, durationMinutes, targetHRZone, coachNotes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const today = new Date();

    for (let i = 0; i < plan.length; i++) {
      const session = plan[i];
      // Calcular la fecha exacta (Día 1 = Mañana)
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + 1 + i);
      const dateString = sessionDate.toISOString().split('T')[0];

      stmt.executeSync([
        session.weekNumber,
        session.dayOfWeek,
        dateString,
        session.activityType,
        session.durationMinutes,
        session.targetHRZone,
        session.coachNotes || ''
      ]);
    }
  } catch (error) {
    console.error('Error saving training plan:', error);
    throw error;
  }
};

export const getTrainingPlanForDate = (dateString: string): PlanSession | null => {
  const db = getDB();
  try {
    return db.getFirstSync<PlanSession>('SELECT * FROM TrainingPlan WHERE date = ?', [dateString]);
  } catch (error) {
    console.error('Error fetching plan for date:', error);
    return null;
  }
};

export const getAllTrainingPlan = (): PlanSession[] => {
  const db = getDB();
  try {
    return db.getAllSync<PlanSession>('SELECT * FROM TrainingPlan ORDER BY id ASC');
  } catch (error) {
    console.error('Error fetching all plan:', error);
    return [];
  }
};

import { getDB } from './database';
import { PlanSession as GeminiPlanSession } from '../services/geminiService';

export type PlanSession = GeminiPlanSession;

export const saveTrainingPlan = (plan: PlanSession[]) => {
  const db = getDB();
  
  try {
    // Limpiamos el plan anterior si existÃ­a para reemplazarlo por el nuevo
    db.runSync('DELETE FROM TrainingPlan');

    // Insertar cada dÃ­a del plan
    // Para optimizar en SQLite, podrÃ­amos usar una transacciÃ³n o batch, pero runSync es suficiente para ~364 filas en SQLite local
    const stmt = db.prepareSync(
      'INSERT INTO TrainingPlan (weekNumber, dayOfWeek, date, activityType, durationMinutes, targetHRZone, coachNotes, requiresGPS) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const today = new Date();

    for (let i = 0; i < plan.length; i++) {
      const session = plan[i];
      // Calcular la fecha exacta (DÃ­a 1 = MaÃ±ana)
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
        session.coachNotes || '',
        session.requiresGPS === false ? 0 : 1 // Convert boolean to SQLite INTEGER (0 = false, 1 = true)
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
    const row = db.getFirstSync<any>('SELECT * FROM TrainingPlan WHERE date = ?', [dateString]);
    if (!row) return null;
    return {
      ...row,
      requiresGPS: row.requiresGPS === 1
    };
  } catch (error) {
    console.error('Error fetching plan for date:', error);
    return null;
  }
};

export const getAllTrainingPlan = (): PlanSession[] => {
  const db = getDB();
  try {
    const rows = db.getAllSync<any>('SELECT * FROM TrainingPlan ORDER BY id ASC');
    return rows.map(r => ({
      ...r,
      requiresGPS: r.requiresGPS === 1
    }));
  } catch (error) {
    console.error('Error fetching all plan:', error);
    return [];
  }
};

export const updatePlanSessions = (updates: (Partial<PlanSession> & { date: string })[]) => {
  const db = getDB();
  try {
    db.withTransactionSync(() => {
      updates.forEach(update => {
        if (!update.date) return;
        
        let query = 'UPDATE TrainingPlan SET ';
        const values: any[] = [];
        const fields = [];

        if (update.activityType !== undefined) { fields.push('activityType = ?'); values.push(update.activityType); }
        if (update.durationMinutes !== undefined) { fields.push('durationMinutes = ?'); values.push(update.durationMinutes); }
        if (update.targetHRZone !== undefined) { fields.push('targetHRZone = ?'); values.push(update.targetHRZone); }
        if (update.coachNotes !== undefined) { fields.push('coachNotes = ?'); values.push(update.coachNotes); }
        if (update.requiresGPS !== undefined) { fields.push('requiresGPS = ?'); values.push(update.requiresGPS === false ? 0 : 1); }

        if (fields.length === 0) return;

        query += fields.join(', ') + ' WHERE date = ?';
        values.push(update.date);

        db.runSync(query, values);
      });
    });
  } catch (error) {
    console.error('Error updating plan sessions:', error);
    throw error;
  }
};

import { getApiKey } from './secureStorage';
import { getAllTrainingPlan, updatePlanSessions, PlanSession } from '../db/trainingPlan';
import { getDB } from '../db/database';
import { Alert } from 'react-native';
import { getActivities } from '../db/activities';
import { hasAiBackend, proactiveCoachViaBackend } from './aiBackend';
import i18n from '../i18n';

export const analyzeCheckinProactively = async (): Promise<boolean> => {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's checkin
    const checkin = db.getFirstSync<any>('SELECT * FROM DailyCheckin WHERE date = ? ORDER BY id DESC LIMIT 1', [today]);
    if (!checkin) return false;
    
    // Only trigger proactive coach if fatigue is 8+ or joint pain is 7+
    if (checkin.fatigue < 8 && checkin.jointPain < 7) {
      return false;
    }

    // Get upcoming plan (next 7 days)
    const plan = getAllTrainingPlan();
    const futurePlan = plan.filter(p => p.date && p.date >= today).slice(0, 7);
    
    if (futurePlan.length === 0) return false;

    const planContextItems = futurePlan.map(p => ({
      date: p.date,
      activityType: p.activityType,
      durationMinutes: p.durationMinutes,
      targetHRZone: p.targetHRZone,
      coachNotes: p.coachNotes,
      requiresGPS: p.requiresGPS
    }));

    if (hasAiBackend()) {
      const response = await proactiveCoachViaBackend({
        today,
        fatigue: checkin.fatigue,
        jointPain: checkin.jointPain,
        language: i18n.language,
        planContext: planContextItems
      });

      if (response.type === 'PLAN_UPDATE' && response.updates && response.updates.length > 0) {
        Alert.alert(
          '🤖 Coach Proactivo',
          response.message || 'He analizado tus métricas y creo que deberíamos reajustar el plan de hoy.',
          [
            { text: 'No, gracias', style: 'cancel' },
            { 
              text: 'Sí, reajustar plan', 
              onPress: () => {
                updatePlanSessions(response.updates!);
                Alert.alert('Estrategia Actualizada', 'Tu plan ha sido reajustado. ¡A descansar y volver con más fuerza!');
              }
            }
          ]
        );
        return true;
      }
      return false;
    }

    // Fallback BYOK
    const apiKey = await getApiKey();
    if (!apiKey) return false;

    const planContext = JSON.stringify(planContextItems);

    const systemPrompt = `Eres un entrenador de atletismo de élite. Tu atleta acaba de registrar su estado diario hoy (${today}):
- Fatiga: ${checkin.fatigue}/10
- Dolor Articular: ${checkin.jointPain}/10

Su plan para los próximos 7 días es:
${planContext}

Debes decidir si es necesario reajustar el plan debido a la alta fatiga o dolor.
Si crees que NO es necesario, devuelve texto vacío o "NO_CHANGE".
Si crees que SÍ es necesario, DEBES DEVOLVER ESTRICTAMENTE un JSON (sin markdown) con esta estructura:
{
  "type": "PLAN_UPDATE",
  "message": "[Mensaje empático escrito en el idioma con código '${i18n.language}' sugiriendo la recuperación o ajuste]",
  "updates": [
    { "date": "${today}", "activityType": "Recovery", "durationMinutes": 30, "targetHRZone": "Z1", "coachNotes": "[Notas en el idioma '${i18n.language}']", "requiresGPS": false }
  ]
}
No devuelvas NADA MÁS que el JSON si decides actualizar.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!response.ok) return false;

    const result = await response.json();
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if (text === 'NO_CHANGE' || !text.includes('PLAN_UPDATE')) return false;

    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'PLAN_UPDATE' && parsed.updates && parsed.updates.length > 0) {
        Alert.alert(
          '🤖 Coach Proactivo',
          parsed.message,
          [
            { text: 'No, gracias', style: 'cancel' },
            { 
              text: 'Sí, reajustar plan', 
              onPress: () => {
                updatePlanSessions(parsed.updates);
                Alert.alert('Estrategia Actualizada', 'Tu plan ha sido reajustado. ¡A descansar y volver con más fuerza!');
              }
            }
          ]
        );
        return true;
      }
    } catch (e) {
      console.log('Failed to parse proactive JSON:', text);
    }

  } catch (error) {
    console.error('Error in proactive coach:', error);
  }
  return false;
};

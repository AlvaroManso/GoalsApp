const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

const SYSTEM_PROMPT = `Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un macrociclo de entrenamiento para las próximas 52 semanas (1 año completo) estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A programado, reduce el volumen de entrenamiento un 30-50% progresivamente las 2 semanas previas.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
5. Equipamiento: Si el usuario indica que dispone de equipamiento de interior (cinta, rodillo/bici, piscina), siéntete libre de programar sesiones específicas usando ese equipo, especialmente útil para recuperación o si la fatiga de impacto es alta.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura para cada día del año: 'weekNumber' (number 1-52), 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Treadmill, Cycling, Strength, Rest, Crosstraining, Swimming), 'durationMinutes' (number), 'targetHRZone' (string), 'coachNotes' (string) y 'requiresGPS' (boolean). El campo 'requiresGPS' debe ser true SÓLO si la actividad requiere medir distancia al aire libre (ej: Run, Cycling). Para entrenamientos indoor (Treadmill, Rodillo, Piscina, Fuerza, Descanso), 'requiresGPS' DEBE SER false para no gastar batería.
Deben ser exactamente 364 objetos (52 semanas * 7 días).`;

const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en Firebase Functions.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

const setCors = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
};

exports.generatePlan = onRequest({ cors: true, region: 'europe-west1' }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    const {
      age,
      gender,
      restingHR,
      fatigue,
      jointPain,
      events = [],
      runAvailability,
      strengthAvailability,
      equipment = [],
      userPreferences,
    } = req.body || {};

    const eventsList = events.map((e) => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');
    const dynamicPrompt = `Atleta de ${age} años. Género: ${gender}. FC Reposo: ${restingHR}. Fatiga: ${fatigue}/10. Dolor articular: ${jointPain}/10.
Eventos próximos en el año: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${runAvailability} run, ${strengthAvailability} fuerza.
Equipamiento disponible en el sitio: [${equipment.length > 0 ? equipment.join(', ') : 'Ninguno, solo exterior'}].
${userPreferences ? `Preferencias y condiciones del usuario: "${userPreferences}"` : ''}
Genera el plan de entrenamiento macrociclo de 52 semanas en JSON.`;

    const model = getModel();
    const result = await model.generateContent({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: dynamicPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const response = await result.response;
    const text = response.text();
    const plan = JSON.parse(text);
    res.status(200).json({ plan });
  } catch (error) {
    logger.error('generatePlan failed', error);
    res.status(500).json({ error: error.message || 'No se pudo generar el plan.' });
  }
});

exports.coachChat = onRequest({ cors: true, region: 'europe-west1' }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    const { message, planContext = [] } = req.body || {};
    const model = getModel();

    const systemInstructionText = `Eres un entrenador de atletismo de élite respondiendo a tu atleta.
Aquí tienes los próximos 60 días de su plan de entrenamiento actual:
---
${JSON.stringify(planContext)}
---
IMPORTANTE:
Si el usuario SOLO hace una pregunta, respóndele de forma concisa y motivadora referenciando su plan.
PERO si el usuario PIDE MODIFICAR el plan, DEBES DEVOLVER ESTRICTAMENTE un JSON con esta estructura:
{
  "type": "PLAN_UPDATE",
  "message": "He modificado tu plan...",
  "updates": [
    { "date": "2024-07-15", "activityType": "Strength", "durationMinutes": 60, "targetHRZone": "Z4", "coachNotes": "Fuerza 5x5", "requiresGPS": false }
  ]
}
Si no hay modificaciones, devuelve JSON así:
{
  "type": "TEXT",
  "message": "respuesta normal"
}`;

    const result = await model.generateContent({
      systemInstruction: {
        parts: [{ text: systemInstructionText }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const response = await result.response;
    const text = response.text();
    const parsed = JSON.parse(text);
    res.status(200).json(parsed);
  } catch (error) {
    logger.error('coachChat failed', error);
    res.status(500).json({ error: error.message || 'No se pudo procesar el chat.' });
  }
});

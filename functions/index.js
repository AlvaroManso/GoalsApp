const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

const rateLimitStore = new Map();

const SYSTEM_PROMPT = `Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un macrociclo de entrenamiento para las próximas 52 semanas (1 año completo) estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A programado, reduce el volumen de entrenamiento un 30-50% progresivamente las 2 semanas previas.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
5. Equipamiento: Si el usuario indica que dispone de equipamiento de interior (cinta, rodillo/bici, piscina), siéntete libre de programar sesiones específicas usando ese equipo, especialmente útil para recuperación o si la fatiga de impacto es alta.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura para cada día del año: 'weekNumber' (number 1-52), 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Treadmill, Cycling, Strength, Rest, Crosstraining, Swimming), 'durationMinutes' (number), 'targetHRZone' (string), 'coachNotes' (string) y 'requiresGPS' (boolean). El campo 'requiresGPS' debe ser true SÓLO si la actividad requiere medir distancia al aire libre (ej: Run, Cycling). Para entrenamientos indoor (Treadmill, Rodillo, Piscina, Fuerza, Descanso), 'requiresGPS' DEBE SER false para no gastar batería.
Deben ser exactamente 364 objetos (52 semanas * 7 días).`;

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en Firebase Functions.');
  }

  return new GoogleGenerativeAI(apiKey);
};

const getCandidateModels = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || 'No se pudieron listar modelos de Gemini.');
  }

  const models = Array.isArray(json?.models) ? json.models : [];
  const supported = models
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => (typeof m.name === 'string' ? m.name.replace(/^models\//, '') : ''))
    .filter(Boolean);

  const preferred = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'];
  const candidates = preferred.filter((name) => supported.includes(name));
  const finalCandidates = candidates.length > 0 ? candidates : supported.slice(0, 5);

  if (finalCandidates.length === 0) {
    throw new Error('No hay modelos Gemini compatibles con generateContent.');
  }

  return finalCandidates;
};

const generateWithFallback = async (requestFactory) => {
  const candidates = await getCandidateModels();
  const genAI = getGenAI();
  let lastError = null;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(requestFactory());
      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error;
      logger.warn(`Modelo Gemini falló en backend: ${modelName}`);
    }
  }

  throw lastError || new Error('No se pudo obtener respuesta de ningún modelo Gemini.');
};

const setCors = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const validatePayloadSize = (req) => {
  const size = JSON.stringify(req.body || {}).length;
  if (size > 100 * 1024) { // 100KB max payload
    throw new Error('Payload too large. Max 100KB allowed.');
  }
};

const getRequesterId = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
};

const cleanupRateLimit = (now) => {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (!entry || entry.resetAt <= now || entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
};

const applyRateLimit = (req, res, bucketName, limit, windowMs) => {
  const now = Date.now();
  cleanupRateLimit(now);

  const requesterId = getRequesterId(req);
  const bucketKey = `${bucketName}:${requesterId}`;
  const existing = rateLimitStore.get(bucketKey) || {
    timestamps: [],
    resetAt: now + windowMs,
  };

  existing.timestamps = existing.timestamps.filter((ts) => now - ts < windowMs);

  if (existing.timestamps.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.timestamps[0] + windowMs - now) / 1000));
    res.status(429).json({
      error: 'Has llegado al límite temporal de peticiones. Espera un momento y vuelve a intentarlo.',
      code: 'RATE_LIMITED',
      retryAfterSeconds,
    });
    return false;
  }

  existing.timestamps.push(now);
  existing.resetAt = now + windowMs;
  rateLimitStore.set(bucketKey, existing);
  return true;
};

const toPublicError = (error, fallbackMessage) => {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.toLowerCase();

  if (message.includes('quota') || message.includes('429') || message.includes('too many requests')) {
    return {
      status: 429,
      body: {
        error: 'La IA está saturada o has agotado temporalmente la cuota. Prueba de nuevo en unos segundos.',
        code: 'AI_QUOTA_EXCEEDED',
      },
    };
  }

  if (message.includes('gemini_api_key')) {
    return {
      status: 500,
      body: {
        error: 'La configuración interna de la IA no está lista todavía.',
        code: 'AI_BACKEND_MISCONFIGURED',
      },
    };
  }

  if (error instanceof SyntaxError || message.includes('json')) {
    return {
      status: 502,
      body: {
        error: 'La IA devolvió una respuesta inesperada. Inténtalo de nuevo.',
        code: 'AI_INVALID_RESPONSE',
      },
    };
  }

  return {
    status: 500,
    body: {
      error: fallbackMessage,
      code: 'AI_BACKEND_ERROR',
    },
  };
};

exports.generatePlan = onRequest({ cors: true, region: 'europe-west1', secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  if (!applyRateLimit(req, res, 'generatePlan', 4, 10 * 60 * 1000)) {
    return;
  }

  try {
    validatePayloadSize(req);
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

    const text = await generateWithFallback(() => ({
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
    }));
    const plan = JSON.parse(text);
    res.status(200).json({ plan });
  } catch (error) {
    logger.error('generatePlan failed', error);
    const publicError = toPublicError(error, 'No se pudo generar el plan ahora mismo.');
    res.status(publicError.status).json(publicError.body);
  }
});

exports.coachChat = onRequest({ cors: true, region: 'europe-west1', secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  if (!applyRateLimit(req, res, 'coachChat', 20, 5 * 60 * 1000)) {
    return;
  }

  try {
    validatePayloadSize(req);
    const { message, planContext = [] } = req.body || {};
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

    const text = await generateWithFallback(() => ({
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
    }));
    const parsed = JSON.parse(text);
    res.status(200).json(parsed);
  } catch (error) {
    logger.error('coachChat failed', error);
    const publicError = toPublicError(error, 'No se pudo procesar tu mensaje ahora mismo.');
    res.status(publicError.status).json(publicError.body);
  }
});

exports.proactiveCoach = onRequest({ cors: true, region: 'europe-west1', secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  if (!applyRateLimit(req, res, 'proactiveCoach', 20, 5 * 60 * 1000)) {
    return;
  }

  try {
    validatePayloadSize(req);
    const { today, fatigue, jointPain, planContext = [] } = req.body || {};

    const systemPrompt = `Eres un entrenador de atletismo de élite. Tu atleta acaba de registrar su estado diario hoy (${today}):
- Fatiga: ${fatigue}/10
- Dolor Articular: ${jointPain}/10

Su plan para los próximos 7 días es:
${JSON.stringify(planContext)}

Debes decidir si es necesario reajustar el plan debido a la alta fatiga o dolor.
Si crees que NO es necesario, devuelve texto vacío o "NO_CHANGE".
Si crees que SÍ es necesario, DEBES DEVOLVER ESTRICTAMENTE un JSON (sin markdown) con esta estructura:
{
  "type": "PLAN_UPDATE",
  "message": "He analizado tus métricas y veo que tu cuerpo pide un respiro. Como tu coach, mi prioridad es evitar lesiones. ¿Te parece si cambiamos la sesión de hoy por recuperación activa para volver más fuertes mañana?",
  "updates": [
    { "date": "${today}", "activityType": "Recovery", "durationMinutes": 30, "targetHRZone": "Z1", "coachNotes": "Recuperación activa por fatiga alta", "requiresGPS": false }
  ]
}
No devuelvas NADA MÁS que el JSON si decides actualizar.`;

    const text = await generateWithFallback(() => ({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: { temperature: 0.2 }
    }));

    if (text === 'NO_CHANGE' || !text.includes('PLAN_UPDATE')) {
      res.status(200).json({ status: 'NO_CHANGE' });
      return;
    }

    try {
      // Intenta limpiar de posibles bloques markdown ```json
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      res.status(200).json(parsed);
    } catch (e) {
      res.status(200).json({ status: 'NO_CHANGE' });
    }
  } catch (error) {
    logger.error('proactiveCoach failed', error);
    const publicError = toPublicError(error, 'No se pudo procesar el coach proactivo.');
    res.status(publicError.status).json(publicError.body);
  }
});

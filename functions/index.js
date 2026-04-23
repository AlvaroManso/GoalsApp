const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

const rateLimitStore = new Map();
let candidateModelsCache = {
  expiresAt: 0,
  models: null,
};

const SYSTEM_PROMPT = `Actúa como un entrenador de atletismo de élite, fisiólogo y nutricionista. Genera un macrociclo de entrenamiento de 52 semanas estructurado en JSON puro.

REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: el 80% del volumen de carrera debe ser en Z1/Z2 conversacional. Solo el 20% en Z4/Z5.
2. Fatiga cruzada: nunca programes una tirada larga de carrera el día posterior a una sesión pesada de fuerza o Hyrox.
3. Tapering: si hay un evento prioridad A, reduce el volumen progresivamente un 30-50% en las 2 semanas previas.
4. Nutrición: para sesiones de más de 90 minutos, incluye una nota breve sobre ingesta de carbohidratos e hidratación.
5. Equipamiento: si el usuario tiene material indoor, úsalo de forma inteligente para recuperación, control de impacto o días de mala climatología.

REGLAS DE ESTRUCTURA:
1. Devuelve estrictamente un array JSON, sin markdown, sin explicaciones, sin texto adicional.
2. Cada objeto representa UNA sesión concreta, no un día completo.
3. Campos obligatorios por objeto: 'weekNumber' (1-52), 'dayOfWeek' (1-7, donde 1 = lunes y 7 = domingo), 'activityType' (string), 'durationMinutes' (number), 'targetHRZone' (string), 'coachNotes' (string) y 'requiresGPS' (boolean).
4. Debe haber cobertura completa de los 364 días del macrociclo: cada combinación weekNumber + dayOfWeek debe aparecer al menos una vez.
5. Si un día tiene doble sesión, devuelve varios objetos consecutivos con el mismo 'weekNumber' y el mismo 'dayOfWeek'.
6. Si un día tiene más de una sesión, NO uses 'Rest' en ese mismo día.
7. Usa 'Rest' solo en días realmente de descanso completo.
8. 'coachNotes' debe ser breve, accionable y estar en el idioma solicitado.

REGLAS DE TRACKER:
1. 'requiresGPS' debe ser true solo si esa sesión necesita medir distancia al aire libre.
2. Ejemplos normalmente con requiresGPS=true: Run exterior, Cycling exterior, Trail.
3. Ejemplos normalmente con requiresGPS=false: Strength, Treadmill, Rodillo, Bici Estática, Swimming, Mobility, Rest, Crosstraining indoor, técnica, core.
4. Si propones doble sesión en un mismo día, intenta que tenga sentido para la app: por ejemplo una sesión GPS y otra sin GPS, o una principal y otra complementaria.

TIPOS DE ACTIVIDAD RECOMENDADOS:
Run, Trail, Cycling, Treadmill, Strength, Hyrox, Crosstraining, Swimming, Mobility, Recovery, Rest.`;

const gpsActivities = ['run', 'trail', 'cycling', 'bike outdoor', 'outdoor ride'];

const inferRequiresGPS = (activityType) => {
  const normalized = String(activityType || '').trim().toLowerCase();
  return gpsActivities.includes(normalized);
};

const normalizeGeneratedPlan = (plan) => {
  if (!Array.isArray(plan)) {
    throw new Error('El plan generado no es un array válido.');
  }

  const normalized = plan
    .map((session, index) => ({
      weekNumber: Number(session?.weekNumber),
      dayOfWeek: Number(session?.dayOfWeek),
      activityType: typeof session?.activityType === 'string' && session.activityType.trim()
        ? session.activityType.trim()
        : 'Rest',
      durationMinutes: Math.max(0, Math.round(Number(session?.durationMinutes) || 0)),
      targetHRZone: typeof session?.targetHRZone === 'string' ? session.targetHRZone.trim() : '',
      coachNotes: typeof session?.coachNotes === 'string' ? session.coachNotes.trim() : '',
      requiresGPS: typeof session?.requiresGPS === 'boolean'
        ? session.requiresGPS
        : inferRequiresGPS(session?.activityType),
      __index: index,
    }))
    .filter((session) => Number.isFinite(session.weekNumber) && Number.isFinite(session.dayOfWeek))
    .filter((session) => session.weekNumber >= 1 && session.weekNumber <= 52 && session.dayOfWeek >= 1 && session.dayOfWeek <= 7)
    .sort((a, b) => {
      if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.__index - b.__index;
    })
    .map(({ __index, ...session }) => session);

  const uniqueDayCount = new Set(normalized.map((session) => `${session.weekNumber}-${session.dayOfWeek}`)).size;
  if (uniqueDayCount !== 364) {
    throw new Error(`El plan no cubre exactamente los 364 días requeridos. Días detectados: ${uniqueDayCount}.`);
  }

  return normalized;
};

const getNextRelevantEvents = (events, today) => {
  const upcoming = Array.isArray(events)
    ? events.filter((event) => typeof event?.date === 'string' && event.date >= today)
    : [];

  const nextEvent = upcoming[0] || null;
  const nextMarathon = upcoming.find((event) => {
    const normalized = `${event?.type || ''} ${event?.description || ''}`.toLowerCase();
    return normalized.includes('marat') && !normalized.includes('media marat') && !normalized.includes('half marathon') && !normalized.includes('semi-marathon');
  }) || null;
  const nextHalfMarathon = upcoming.find((event) => {
    const normalized = `${event?.type || ''} ${event?.description || ''}`.toLowerCase();
    return normalized.includes('media marat') || normalized.includes('half marathon') || normalized.includes('semi-marathon');
  }) || null;

  return { upcoming, nextEvent, nextMarathon, nextHalfMarathon };
};

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en Firebase Functions.');
  }

  return new GoogleGenerativeAI(apiKey);
};

const getCandidateModels = async () => {
  const now = Date.now();
  if (candidateModelsCache.models && candidateModelsCache.expiresAt > now) {
    return candidateModelsCache.models;
  }

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

  candidateModelsCache = {
    expiresAt: now + 10 * 60 * 1000,
    models: finalCandidates,
  };

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
      sessionTimingPreference,
      preferredRestDay,
      amTimeBudget,
      pmTimeBudget,
      language = 'es',
    } = req.body || {};

    const eventsList = events.map((e) => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');
    const dynamicPrompt = `Atleta de ${age} años. Género: ${gender}. FC Reposo: ${restingHR}. Fatiga: ${fatigue}/10. Dolor articular: ${jointPain}/10.
Eventos próximos en el año: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${runAvailability} sesiones principales de carrera/nado/bici, ${strengthAvailability} de fuerza.
Equipamiento disponible en el sitio: [${equipment.length > 0 ? equipment.join(', ') : 'Ninguno, solo exterior'}].
${userPreferences ? `Preferencias y condiciones del usuario: "${userPreferences}"` : ''}
Genera el plan de entrenamiento macrociclo de 52 semanas en JSON.
IMPORTANTE:
- El campo 'coachNotes' DEBE estar escrito en el idioma con código '${language}'.
- La app diferencia entre sesiones con tracker GPS y sesiones sin GPS.
- Puedes programar doble sesión el mismo día si tiene sentido fisiológico y logístico.
- Si generas doble sesión el mismo día, devuelve varios objetos consecutivos con el mismo weekNumber y dayOfWeek.
- Preferencia de franja horaria: ${sessionTimingPreference || 'sin preferencia'}.
- Día de descanso preferido: ${preferredRestDay || 'sin preferencia'}.
- Tiempo disponible AM: ${amTimeBudget || 'sin especificar'}.
- Tiempo disponible PM: ${pmTimeBudget || 'sin especificar'}.
- Si AM o PM es 0 min, evita programar sesiones en esa franja.
- Si ambos bloques tienen poco tiempo, evita dobles sesiones salvo que sea muy justificable.
- No inventes campos extra.`;

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
    const plan = normalizeGeneratedPlan(JSON.parse(text));
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
    const { message, planContext = [], eventsContext = [], athleteContext = {}, language = 'es' } = req.body || {};
    const today = new Date().toISOString().split('T')[0];
    const { upcoming, nextEvent, nextMarathon, nextHalfMarathon } = getNextRelevantEvents(eventsContext, today);
    logger.info('coachChat context', {
      today,
      message,
      upcomingCount: upcoming.length,
      hasAthleteContext: Boolean(athleteContext && Object.keys(athleteContext).length > 0),
      nextEvent: nextEvent ? { type: nextEvent.type, date: nextEvent.date } : null,
      nextMarathon: nextMarathon ? { type: nextMarathon.type, date: nextMarathon.date } : null,
      nextHalfMarathon: nextHalfMarathon ? { type: nextHalfMarathon.type, date: nextHalfMarathon.date } : null,
    });
    const systemInstructionText = `Eres un entrenador de atletismo de élite respondiendo a tu atleta en el idioma '${language}'.
Hoy es ${today}.
Aquí tienes los próximos 60 días de su plan de entrenamiento actual:
---
${JSON.stringify(planContext)}
---
Y aquí tienes sus eventos/configuración objetivo:
---
${JSON.stringify(upcoming)}
---
Y aquí tienes el contexto completo del atleta:
---
${JSON.stringify(athleteContext)}
---
Próximo evento futuro: ${nextEvent ? `${nextEvent.type} el ${nextEvent.date}` : 'ninguno'}.
Próxima maratón futura: ${nextMarathon ? `${nextMarathon.type} el ${nextMarathon.date}` : 'ninguna'}.
Próxima media maratón futura: ${nextHalfMarathon ? `${nextHalfMarathon.type} el ${nextHalfMarathon.date}` : 'ninguna'}.
IMPORTANTE:
Antes de responder o modificar nada, integra mentalmente plan, eventos y contexto del atleta.
Si el usuario SOLO hace una pregunta, respóndele de forma concisa, útil y muy personalizada.
Si la pregunta afecta a una carrera, test, objetivo o fecha importante, usa también el contexto de eventos.
Si la pregunta afecta a carga, recuperación, intensidad, nutrición, suplementos, hidratación, pérdida de peso, composición corporal o cambios de calendario, usa también el perfil fisiológico, las preferencias y el último check-in si existe.
Si te preguntan por la carrera más cercana, el próximo evento, la próxima maratón o la próxima media maratón, usa solo fechas que existan en el contexto y prioriza siempre las futuras respecto a hoy.
Debes tratar "carrera próxima", "evento más cercano", "la más cercana", "próximo objetivo", "próxima maratón" y "próxima media maratón" como consultas sobre el calendario real del usuario.
Antes de responder una fecha, revisa explícitamente los eventos futuros del contexto y elige el primero que corresponda a la pregunta.
No inventes fechas ni menciones eventos que no estén en el contexto.
PERO si el usuario PIDE MODIFICAR el plan, DEBES DEVOLVER ESTRICTAMENTE un JSON con esta estructura:
{
  "type": "PLAN_UPDATE",
  "message": "He modificado tu plan...",
  "updates": [
    { "date": "2024-07-15", "activityType": "Strength", "durationMinutes": 60, "targetHRZone": "Z4", "coachNotes": "Fuerza 5x5", "requiresGPS": false }
  ]
}
REGLAS PARA PLAN_UPDATE:
- Antes de proponer cambios, revisa la semana afectada, los eventos futuros, la fatiga, el dolor articular, el perfil fisiológico y las preferencias del atleta.
- Solo puedes actualizar fechas que existan en el contexto.
- Mantén coherencia entre 'activityType' y 'requiresGPS'.
- Si divides un día en dos sesiones, devuelve ambas en 'updates' con la misma fecha.
- No añadas markdown ni texto fuera del JSON.
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
    const { today, fatigue, jointPain, planContext = [], eventsContext = [], athleteContext = {}, language = 'es' } = req.body || {};

    const systemPrompt = `Eres un entrenador de atletismo de élite. Tu atleta acaba de registrar su estado diario hoy (${today}):
- Fatiga: ${fatigue}/10
- Dolor Articular: ${jointPain}/10

Su plan para los próximos 7 días es:
${JSON.stringify(planContext)}

Sus próximos eventos son:
${JSON.stringify(eventsContext)}

Su contexto completo de atleta es:
${JSON.stringify(athleteContext)}

Debes decidir si es necesario reajustar el plan debido a la alta fatiga o dolor.
Si crees que NO es necesario, devuelve texto vacío o "NO_CHANGE".
Si crees que SÍ es necesario, DEBES DEVOLVER ESTRICTAMENTE un JSON (sin markdown) con esta estructura:
{
  "type": "PLAN_UPDATE",
  "message": "[Mensaje empático escrito en el idioma con código '${language}' sugiriendo la recuperación o ajuste]",
  "updates": [
    { "date": "${today}", "activityType": "Recovery", "durationMinutes": 30, "targetHRZone": "Z1", "coachNotes": "[Notas en el idioma '${language}']", "requiresGPS": false }
  ]
}
REGLAS:
- Antes de reajustar, revisa carga próxima, cercanía de eventos, perfil fisiológico y preferencias del atleta.
- Mantén la respuesta extremadamente conservadora y segura.
- No añadas sesiones GPS si el objetivo es descargar fatiga.
- Si el día ya tiene doble sesión, prioriza eliminar carga o convertir una sesión a recuperación/no GPS.
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

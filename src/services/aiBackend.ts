import type { PlanSession } from './geminiService';

const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL?.trim() || '';
const GENERATE_PLAN_URL =
  process.env.EXPO_PUBLIC_AI_GENERATE_PLAN_URL?.trim() ||
  (BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/generatePlan` : '');
const COACH_CHAT_URL =
  process.env.EXPO_PUBLIC_AI_COACH_CHAT_URL?.trim() ||
  (BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/coachChat` : '');
const PROACTIVE_COACH_URL =
  process.env.EXPO_PUBLIC_AI_PROACTIVE_COACH_URL?.trim() ||
  (BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/proactiveCoach` : '');

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CoachUpdate = {
  date: string;
  activityType?: string;
  durationMinutes?: number;
  targetHRZone?: string;
  coachNotes?: string;
  requiresGPS?: boolean;
};

export type CoachBackendResponse =
  | {
      type: 'PLAN_UPDATE';
      message: string;
      updates: CoachUpdate[];
    }
  | {
      type: 'TEXT';
      message: string;
    };

export const hasAiBackend = () => Boolean(GENERATE_PLAN_URL && COACH_CHAT_URL);

const responseCache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

class BackendError extends Error {
  status?: number;
  code?: string;
  retryAfterSeconds?: number;
}

const getCacheKey = (prefix: string, payload: unknown) => `${prefix}:${JSON.stringify(payload)}`;

const withMemoryCache = async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const cached = responseCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetcher()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
};

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  if (!url) {
    throw new Error('Backend IA no configurado.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new BackendError(json?.error || json?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = json?.code;
    error.retryAfterSeconds = json?.retryAfterSeconds;
    throw error;
  }

  return json as T;
};

export const generatePlanViaBackend = async (payload: {
  age: number;
  gender: string;
  restingHR: number;
  fatigue: number;
  jointPain: number;
  events: { type: string; priority: string; date: string }[];
  runAvailability: number;
  strengthAvailability: number;
  equipment: string[];
  userPreferences?: string;
}): Promise<PlanSession[]> => {
  const key = getCacheKey('generatePlan', payload);
  return withMemoryCache(key, 2 * 60 * 1000, async () => {
    const json = await postJson<{ plan: PlanSession[] }>(GENERATE_PLAN_URL, payload);
    return Array.isArray(json.plan) ? json.plan : [];
  });
};

export const coachChatViaBackend = async (payload: {
  message: string;
  planContext: Array<{
    date?: string;
    activityType: string;
    durationMinutes: number;
    targetHRZone: string;
    coachNotes: string;
    requiresGPS?: boolean;
  }>;
}): Promise<CoachBackendResponse> => {
  const key = getCacheKey('coachChat', payload);
  return withMemoryCache(key, 20 * 1000, () => postJson<CoachBackendResponse>(COACH_CHAT_URL, payload));
};

export const proactiveCoachViaBackend = async (payload: {
  today: string;
  fatigue: number;
  jointPain: number;
  planContext: Array<{
    date?: string;
    activityType: string;
    durationMinutes: number;
    targetHRZone: string;
    coachNotes: string;
    requiresGPS?: boolean;
  }>;
}): Promise<{ type?: string; message?: string; updates?: CoachUpdate[]; status?: string }> => {
  return postJson(PROACTIVE_COACH_URL, payload);
};

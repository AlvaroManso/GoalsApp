import { Activity } from '../db/activities';
import { PlanSession } from '../db/trainingPlan';

const getSessionCompletionKey = (date: string, activityType: string) =>
  `${date}::${activityType.trim().toLowerCase()}`;

export const calculateStreak = (activities: Activity[], planSessions?: PlanSession[]): number => {
  if (!activities || activities.length === 0) return 0;

  let uniqueDates: Set<string>;

  if (planSessions && planSessions.length > 0) {
    const completedSessionKeys = new Set(
      activities
        .filter(act => Boolean(act.type))
        .map(act => getSessionCompletionKey(act.date.split('T')[0], act.type || 'Running'))
    );

    const groupedByDate = new Map<string, PlanSession[]>();
    planSessions.forEach(session => {
      if (!session.date || session.activityType.toLowerCase() === 'rest') return;
      const list = groupedByDate.get(session.date) || [];
      list.push(session);
      groupedByDate.set(session.date, list);
    });

    uniqueDates = new Set(
      Array.from(groupedByDate.entries())
        .filter(([, sessions]) =>
          sessions.every(session => completedSessionKeys.has(getSessionCompletionKey(session.date!, session.activityType)))
        )
        .map(([date]) => date)
    );
  } else {
    // Extract unique dates of completed workouts
    uniqueDates = new Set(
      activities.map(act => act.date.split('T')[0])
    );
  }

  // Rebuild from unique calendar days so late manual completions extend the streak correctly.
  uniqueDates = new Set(Array.from(uniqueDates));

  const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (sortedDates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const mostRecentStr = sortedDates[0];
  const mostRecentDate = new Date(mostRecentStr + 'T12:00:00Z');
  mostRecentDate.setHours(0, 0, 0, 0);

  // If the most recent workout is older than yesterday, streak is broken (0)
  if (mostRecentDate.getTime() < yesterday.getTime()) {
    return 0;
  }

  let streak = 0;
  let checkDate = mostRecentDate; // Can be today or yesterday

  for (let i = 0; i < sortedDates.length; i++) {
    const d = new Date(sortedDates[i] + 'T12:00:00Z');
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1); // Move back one day
    } else {
      break; // Gap found
    }
  }

  return streak;
};

export const getLastWeekSummary = (activities: Activity[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dayOfWeek = today.getDay() || 7; // 1 = Monday, 7 = Sunday
  
  // Last week's Sunday
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  
  // Last week's Monday
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  const lastWeekActivities = activities.filter(act => {
    const actDate = new Date(act.date.split('T')[0] + 'T12:00:00Z');
    actDate.setHours(0, 0, 0, 0);
    return actDate.getTime() >= lastMonday.getTime() && actDate.getTime() <= lastSunday.getTime();
  });

  const summary = {
    workouts: lastWeekActivities.length,
    distanceKm: 0,
    durationMinutes: 0,
    calories: 0,
    hasData: lastWeekActivities.length > 0,
    hasDistance: false,
  };

  lastWeekActivities.forEach(act => {
    summary.distanceKm += act.distanceKm || 0;
    summary.durationMinutes += act.durationMinutes || 0;
    summary.calories += act.calories || 0;
    if ((act.distanceKm || 0) > 0) {
      summary.hasDistance = true;
    }
  });

  // Round distance to 1 decimal
  summary.distanceKm = Math.round(summary.distanceKm * 10) / 10;

  return summary;
};

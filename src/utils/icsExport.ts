import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { PlanSession } from '../db/trainingPlan';

const formatDateForICS = (dateStr: string, minutesToAdd: number = 0): string => {
  // Use 12:00:00Z to avoid timezone shifts, as specified in core memory
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setMinutes(date.getMinutes() + minutesToAdd);
  
  // Format to YYYYMMDDTHHmmssZ
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const generateICSString = (plan: PlanSession[]): string => {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoalsApp//TrainingPlan//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n') + '\r\n';

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  plan.forEach((session, index) => {
    if (!session.date) return;
    
    // We start the session at 12:00 PM UTC
    const dtstart = formatDateForICS(session.date, 0);
    const dtend = formatDateForICS(session.date, session.durationMinutes || 60);
    const summary = `${session.activityType}${session.targetHRZone ? ` (${session.targetHRZone})` : ''}`;
    const description = session.coachNotes ? session.coachNotes.replace(/\n/g, '\\n') : '';

    ics += [
      'BEGIN:VEVENT',
      `UID:goalsapp-session-${session.date}-${index}@goalsapp.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT'
    ].join('\r\n') + '\r\n';
  });

  ics += 'END:VCALENDAR\r\n';
  return ics;
};

export const exportPlanToICS = async (plan: PlanSession[], t: any) => {
  try {
    const validSessions = plan.filter(s => s.date && s.activityType.toLowerCase() !== 'rest');
    
    if (validSessions.length === 0) {
      Alert.alert('Aviso', t('calendarScreen.noEventsExport'));
      return;
    }

    const icsContent = generateICSString(validSessions);
    const fileUri = `${FileSystem.documentDirectory}GoalsApp_TrainingPlan.ics`;
    
    await FileSystem.writeAsStringAsync(fileUri, icsContent, {
      encoding: FileSystem.EncodingType.UTF8
    });

    const canShare = await Sharing.isAvailableAsync();
    
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/calendar',
        dialogTitle: t('calendarScreen.exportSuccess'),
        UTI: 'public.calendar-event'
      });
    } else {
      Alert.alert('Error', t('calendarScreen.cantShare'));
    }
  } catch (error) {
    console.error('Error exporting ICS:', error);
    Alert.alert('Error', t('calendarScreen.exportError'));
  }
};

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { updatePlanSessions, PlanSession } from '../db/trainingPlan';

export const importPlanFromICS = async (t: any, onSuccess: () => void) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/calendar', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    const file = result.assets[0];
    const content = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (!content.includes('BEGIN:VCALENDAR')) {
      Alert.alert('Error', t('calendarScreen.importError'));
      return;
    }

    // Basic ICS parser
    const events = content.split('BEGIN:VEVENT');
    const updates: (Partial<PlanSession> & { date: string })[] = [];

    // Skip the first element as it's the calendar header
    for (let i = 1; i < events.length; i++) {
      const eventData = events[i];
      
      const dtstartMatch = eventData.match(/DTSTART:(\d{4})(\d{2})(\d{2})T/);
      const summaryMatch = eventData.match(/SUMMARY:(.*)/);
      const descMatch = eventData.match(/DESCRIPTION:(.*)/);

      if (dtstartMatch && summaryMatch) {
        const dateStr = `${dtstartMatch[1]}-${dtstartMatch[2]}-${dtstartMatch[3]}`;
        const rawSummary = summaryMatch[1].trim();
        
        // Try to extract HR Zone from summary if it exists e.g., "Running (Z2)"
        let activityType = rawSummary;
        let targetHRZone = '';
        const zoneMatch = rawSummary.match(/(.*?)\s*\((Z\d)\)/);
        
        if (zoneMatch) {
          activityType = zoneMatch[1].trim();
          targetHRZone = zoneMatch[2];
        }

        const coachNotes = descMatch ? descMatch[1].replace(/\\n/g, '\n').trim() : '';

        updates.push({
          date: dateStr,
          activityType,
          targetHRZone,
          coachNotes,
          requiresGPS: activityType.toLowerCase() !== 'rest' && activityType.toLowerCase() !== 'fuerza',
        });
      }
    }

    if (updates.length > 0) {
      updatePlanSessions(updates);
      Alert.alert('Éxito', t('calendarScreen.importSuccess'));
      onSuccess();
    } else {
      Alert.alert('Aviso', t('calendarScreen.importError'));
    }

  } catch (error) {
    console.error('Error importing ICS:', error);
    Alert.alert('Error', t('calendarScreen.importError'));
  }
};

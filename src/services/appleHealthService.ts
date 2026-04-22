/**
 * IMPLEMENTACIÓN REAL DE APPLE HEALTHKIT (Para compilar con EAS Build)
 * 
 * Instrucciones:
 * 1. Instalar librería: `npm install react-native-health`
 * 2. Añadir plugin en app.json:
 *    "plugins": [
 *      [
 *        "react-native-health",
 *        {
 *          "NSHealthShareUsageDescription": "GoalsApp necesita leer tu frecuencia cardíaca y entrenamientos para ajustar tu plan.",
 *          "NSHealthUpdateUsageDescription": "GoalsApp necesita guardar tus entrenamientos completados en Apple Health."
 *        }
 *      ]
 *    ]
 * 3. Compilar con EAS: `eas build --profile development --platform ios`
 */

/*
import AppleHealthKit, { HealthValue, HealthKitPermissions, HealthInputOptions } from 'react-native-health';

const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned
    ],
  },
} as HealthKitPermissions;

export const initHealthKit = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        console.log('[ERROR] No se pudieron obtener permisos de HealthKit!', error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// 1. Leer Frecuencia Cardíaca en vivo durante el Tracker
export const startHeartRateTracking = (onUpdate: (hr: number) => void) => {
  AppleHealthKit.initHealthKit(permissions, (error: string) => {
    if (error) return;
    
    // Configurar observador en segundo plano
    AppleHealthKit.setObserver({ type: AppleHealthKit.Constants.Observers.HeartRate });
    // Suscribirse a los eventos
    // Nota: Requiere configuración adicional de NativeEventEmitter en la pantalla Tracker
  });
};

// 2. Sincronización Bidireccional: Leer entrenamientos externos (Ej: Strava, Garmin)
export const syncExternalWorkouts = async (startDate: Date): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      limit: 10,
      ascending: false,
    };
    
    AppleHealthKit.getSamples(options, (err: Object, results: Array<HealthValue>) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
      // Aquí se mapearían los resultados a la base de datos `ActivitiesHistory` 
      // para marcar el día como completado automáticamente.
    });
  });
};

// 3. Exportar un entrenamiento completado en GoalsApp hacia Apple Health
export const saveWorkoutToHealthKit = (
  type: string, 
  startDate: Date, 
  endDate: Date, 
  calories: number, 
  distanceKm: number
) => {
  const options = {
    type: AppleHealthKit.Constants.Activities.Running, // Mapear `type` al constante correcto
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    energyBurned: calories,
    energyBurnedUnit: 'calorie',
    distance: distanceKm * 1000,
    distanceUnit: 'meter'
  };

  AppleHealthKit.saveWorkout(options, (err: Object, res: HealthValue) => {
    if (err) {
      console.log('Error guardando workout en HealthKit:', err);
    } else {
      console.log('Workout guardado exitosamente en Apple Health', res);
    }
  });
};
*/

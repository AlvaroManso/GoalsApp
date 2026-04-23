# Sprint 01: Setup, MVP & Refinements

## 🎯 Objetivos del Sprint
- Inicializar el proyecto con Expo, TypeScript, y NativeWind.
- Configurar persistencia local con SQLite.
- Implementar la arquitectura y las 4 fases principales del MVP (Onboarding, CRUD Eventos, Gemini AI, GPS Tracker).
- Refinar la interfaz, consolidar un tema oscuro fijo, estabilizar la navegación y mejorar la IA para que pueda modificar el plan.

## 🚀 Funcionalidades Implementadas

### 1. Arquitectura y Base de Datos
- **SQLite (`src/db/database.ts`)**: Migraciones dinámicas con bloque try/catch. Tablas para `UserProfile`, `DailyCheckin`, `Events`, `TrainingPlan`, `ActivityHistory` y `AppSettings`.
- **Navegación (`App.tsx`, `AppNavigator.tsx`)**: Se estabiliza la jerarquía con un único `NavigationContainer` en la raíz, `GestureHandlerRootView` y stack/tabs sin contenedores anidados.
- **Compatibilidad NativeWind**: Se mantiene un parche persistente con `patch-package` sobre `react-native-css-interop` para evitar remounts y errores de interacción con React Navigation.

### 2. Fase 1: Perfil y Check-In
- **Onboarding (`OnboardingScreen.tsx`)**: Recopila peso, altura, edad, nivel y FC en reposo.
- **Check-In (`CheckInScreen.tsx`)**: Slider para fatiga, dolor articular y calidad de sueño, ajustado al tema oscuro fijo de la app.
- **Perfil (`ProfileScreen.tsx`)**: Pantalla accesible desde el menú superior para editar métricas biométricas y cambiar idioma. Se elimina el selector de tema para evitar estados visuales inconsistentes.

### 3. Fase 2: Creador de Eventos
- **Dashboard (`DashboardScreen.tsx`)**: Interfaz principal para añadir eventos (con selector nativo de fecha `DateTimePicker`). Permite eventos de carrera, ciclismo, triatlón y "Otro".

### 4. Fase 3: Motor IA (Google Gemini)
- **Generación de Macrociclo**: Se envían datos de fatiga, eventos y preferencias del usuario para generar un plan estructurado en JSON de 52 semanas.
- **Preferencias Pre-generación**: El usuario puede indicar equipamiento indoor, notas libres, franja horaria preferida (`AM/PM/ambos según intensidad`), minutos disponibles en `AM` y `PM`, día de descanso preferido y disponibilidad semanal flexible para cardio principal y fuerza.
- **Coach IA y Modificación de Plan (`ChatScreen.tsx`)**: Un chatbot que responde usando no solo las próximas 60 sesiones del plan, sino también eventos objetivo, perfil biométrico, último check-in y preferencias activas del atleta; además tiene la capacidad de emitir un JSON especial (`PLAN_UPDATE`) que la app interpreta para sobreescribir la base de datos (Ej: "Cambia todos los entrenamientos de fuerza a 5 repeticiones").
- **Backend IA**: La ruta principal ya pasa por Firebase Functions (`generatePlan`, `coachChat`, `proactiveCoach`) usando secreto de servidor. El modo BYOK queda como alternativa de desarrollo guardada en `expo-secure-store`.
- **Prompt Alineado con la App**: La IA ya puede devolver varias sesiones en un mismo día y diferenciar correctamente entre sesiones con GPS y sin GPS.

### 5. Fase 4: Tracker y Fisiología
- **Tracker GPS y Multipropósito (`TrackerScreen.tsx`)**: Mide distancia, ritmo medio, ritmo actual, tiempo y dibuja la ruta usando `expo-location`. Ahora se adapta al tipo de actividad: si es de Fuerza o Descanso, se oculta la distancia y el ritmo, mostrando solo un gran cronómetro central.
- **Fórmulas Médicas**: Cálculos realistas de gasto calórico basados en Keytel et al. (2005).
- **Historial (`HistoryScreen.tsx`)**: Lista de entrenamientos guardados con un mini-mapa tipo Strava usando `react-native-maps`.
- **Preferencias de Unidad**: El usuario puede elegir `km/mi` y `kg/lbs` desde ajustes.

### 6. Refinamientos de UI/UX
- **Tema Oscuro Fijo**: Se unifica la experiencia visual en modo oscuro estable para evitar inconsistencias y eliminar cambios dinámicos de tema que interferían con la navegación.
- **Gestión de Entrenos Semanales**: El Dashboard muestra ahora los **7 días** de la semana. Los entrenamientos tienen un indicador visual (✓) y se atenúan al completarlos. 
- **Navegación Fluida**: Tocar un entrenamiento no completado en el Dashboard o el Calendario abre directamente el Tracker pre-configurado para esa actividad. El calendario vuelve a recargar datos en `focus` para reflejar cambios hechos desde Dashboard, Chat o Tracker.
- **Tracker Inteligente (requiresGPS)**: La IA determina si una actividad necesita GPS o no. El Tracker adapta su interfaz dinámicamente, ocultando la distancia y los ritmos para actividades indoor o de fuerza, y ahorrando batería al no solicitar ubicación.
- **Calendario Portátil**: El usuario puede exportar e importar sesiones mediante `.ics`.

### 7. Próxima fase propuesta: Coach definitivo
- **Contexto unificado del atleta**: Unificar `generatePlan`, `coachChat` y `proactiveCoach` para que lean la misma foto del atleta: perfil, eventos, check-ins, preferencias activas e historial reciente.
- **Planificación más inteligente**: Hacer que cualquier modificación del calendario revise semana afectada, objetivos próximos, disponibilidad AM/PM, recuperación y tipo de sesión antes de proponer cambios.
- **Guardrails de salud y nutrición**: Endurecer el comportamiento del coach para nutrición, hidratación, suplementos, pérdida de peso y recomendaciones sensibles.
- **Base para un agente IA real**: Valorar una capa previa de razonamiento/planificación antes de emitir `PLAN_UPDATE`, acercando el sistema a un coach especializado más consistente.

## 🔧 Tecnologías Usadas
- **React Native (Expo)**
- **NativeWind (Tailwind CSS)**
- **Google Gemini API**
- **Expo SQLite**
- **Expo Location**
- **React Native Maps**

## 📋 Pendiente / Próximos Pasos
- Sincronización real con Apple HealthKit/Google Fit para FC en vivo (actualmente se usa un Mock).
- Autenticación real del backend IA y/o App Check.
- Limpieza final de textos hardcodeados y background location robusto para salidas largas.

## ✅ TODO Prioritario

### API / Seguridad
- Añadir Auth real al backend IA.
- Añadir App Check o protección equivalente.
- Sustituir el rate limiting en memoria por una estrategia más sólida.
- Decidir si BYOK queda solo para desarrollo.

### Modelo de sesiones
- Introducir `sessionId` real para soportar varias sesiones del mismo tipo el mismo día.
- Reajustar streaks y resúmenes cuando exista `sessionId`.
- Seguir validando en pruebas reales la lógica de sesiones GPS y no-GPS.

### Tracker / Salud
- Implementar background location robusto para salidas largas.
- Sustituir mocks de salud por integración real con Health / Fit.
- Revisar política final de guardado de actividades cortas según uso real.

### UX / i18n
- Eliminar textos hardcodeados restantes.
- Revisar copies en los 5 idiomas.
- Mostrar mejor las preferencias activas de generación en Dashboard.

### Deuda técnica / backlog
- Resolver el destino de `temp_app/`.
- Optimizar el historial si crece mucho.
- Mejorar notificaciones, resúmenes, gamificación, widgets y sharing social.

## 🗺️ Roadmap de Producto

### Now
- Coach Proactivo.
- Adherencia / progreso visible.
- Notificaciones locales inteligentes.
- Consistencia de datos del perfil / check-in / plan.
- Reducir fricción de la API key.

### Next
- Integración real con Health / Fit.
- Resúmenes semanales.
- Modo objetivo / race week.
- Gamificación con sentido.
- Revisión completa del coach para llevarlo al "coach definitivo".

### Later
- Widgets.
- Múltiples goals avanzados.
- Exportaciones más sofisticadas.
- Sharing social.

# Sprint 01: Setup, MVP & Refinements

## 🎯 Objetivos del Sprint
- Inicializar el proyecto con Expo, TypeScript, y NativeWind.
- Configurar persistencia local con SQLite.
- Implementar la arquitectura y las 4 fases principales del MVP (Onboarding, CRUD Eventos, Gemini AI, GPS Tracker).
- Refinar la interfaz, añadir el modo claro/oscuro, centrar botones de navegación y mejorar la IA para que pueda modificar el plan.

## 🚀 Funcionalidades Implementadas

### 1. Arquitectura y Base de Datos
- **SQLite (`src/db/database.ts`)**: Migraciones dinámicas con bloque try/catch. Tablas para `UserProfile`, `DailyCheckin`, `Events`, `TrainingPlan` y `ActivityHistory`.
- **Navegación (`AppNavigator.tsx`)**: Bottom Tabs Navigator rediseñado con un botón central flotante para el Tracker y la eliminación de librerías de iconos problemáticas (se usa `@expo/vector-icons`).

### 2. Fase 1: Perfil y Check-In
- **Onboarding (`OnboardingScreen.tsx`)**: Recopila peso, altura, edad, nivel y FC en reposo.
- **Check-In (`CheckInScreen.tsx`)**: Slider para fatiga, dolor articular y calidad de sueño. Totalmente compatible con el modo claro/oscuro.
- **Perfil (`ProfileScreen.tsx`)**: Nueva pantalla accesible desde el menú superior para editar las métricas biométricas y alternar el tema visual de la aplicación.

### 3. Fase 2: Creador de Eventos
- **Dashboard (`DashboardScreen.tsx`)**: Interfaz principal para añadir eventos (con selector nativo de fecha `DateTimePicker`). Permite eventos de carrera, ciclismo, triatlón y "Otro".

### 4. Fase 3: Motor IA (Google Gemini)
- **Generación de Macrociclo**: Se envían datos de fatiga, eventos y preferencias del usuario para generar un plan estructurado en JSON de 52 semanas.
- **Preferencias Pre-generación**: Se permite al usuario indicar el equipamiento indoor del que dispone y escribir texto libre (Ej: "En agosto hace calor en Sevilla, adapta los entrenos").
- **Coach IA y Modificación de Plan (`ChatScreen.tsx`)**: Un chatbot que no solo responde preguntas leyendo las próximas 60 sesiones del plan, sino que además tiene la capacidad de emitir un JSON especial (`PLAN_UPDATE`) que la app interpreta para sobreescribir la base de datos (Ej: "Cambia todos los entrenamientos de fuerza a 5 repeticiones").

### 5. Fase 4: Tracker y Fisiología
- **Tracker GPS y Multipropósito (`TrackerScreen.tsx`)**: Mide distancia, ritmo medio, ritmo actual, tiempo y dibuja la ruta usando `expo-location`. Ahora se adapta al tipo de actividad: si es de Fuerza o Descanso, se oculta la distancia y el ritmo, mostrando solo un gran cronómetro central.
- **Fórmulas Médicas**: Cálculos realistas de gasto calórico basados en Keytel et al. (2005).
- **Historial (`HistoryScreen.tsx`)**: Lista de entrenamientos guardados con un mini-mapa tipo Strava usando `react-native-maps`.

### 6. Refinamientos de UI/UX
- **Light/Dark Mode**: Integración total de la paleta de colores adaptable en toda la aplicación (Dashboard, Calendar, History, Chat, Tracker, Profile) con un Switch manual en el perfil.
- **Tracker Button**: Botón flotante re-diseñado a un estilo indigo vibrante en el centro del Bottom Tab Navigator.
- **Gestión de Entrenos Semanales**: El Dashboard muestra ahora los **7 días** de la semana. Los entrenamientos tienen un indicador visual (✓) y se atenúan al completarlos. 
- **Navegación Fluida**: Tocar un entrenamiento no completado en el Dashboard o el Calendario abre directamente el Tracker pre-configurado para esa actividad. Soporte de Pull-to-Refresh para recargar datos tras hablar con la IA.
- **Tracker Inteligente (requiresGPS)**: La IA determina si una actividad necesita GPS o no. El Tracker adapta su interfaz dinámicamente, ocultando la distancia y los ritmos para actividades indoor o de fuerza, y ahorrando batería al no solicitar ubicación.

## 🔧 Tecnologías Usadas
- **React Native (Expo)**
- **NativeWind (Tailwind CSS)**
- **Google Generative AI SDK**
- **Expo SQLite**
- **Expo Location**
- **React Native Maps**

## 📋 Pendiente / Próximos Pasos
- Sincronización real con Apple HealthKit/Google Fit para FC en vivo (actualmente se usa un Mock).
- Exportación del plan de entrenamiento a .ics (Calendario del móvil).

# Especificación de Proyecto: AI Hybrid Athlete Coach (Cross-Platform / Expo)

## 1. Contexto y Objetivo
Desarrollo de una aplicación para "atleta híbrido" desarrollada en Windows para ser ejecutada en iOS vía Expo. La app funciona como un entrenador inteligente, organizando entrenamientos (maratón, fuerza, Hyrox) aplicando lógica de fatiga cruzada y periodización científica (80/20) mediante Gemini API.

## 2. Stack Tecnológico y Requisitos Estrictos
* **Framework:** React Native con Expo SDK 50+.
* **Lenguaje:** TypeScript (Tipado estricto obligatorio).
* **Base de Datos:** SQLite (`expo-sqlite`) para almacenamiento local robusto.
* **Seguridad:** API Key guardada estrictamente en `expo-secure-store`. Prohibido usar texto plano.
* **Integraciones Core:** * `expo-location` (Tracking GPS en background).
  * **Aviso HealthKit:** Como la app se probará en Expo Go, las llamadas a Apple Health deben estar **mockeadas (simuladas)** en una clase `HealthServiceMock` para evitar crashes. La implementación real (`react-native-health`) se dejará comentada para compilarla en el futuro con EAS Build.
* **Configuración (`app.json`):** Añadir los plugins y permisos necesarios para Location y Background Modes.

## 3. Funcionalidades Core y Arquitectura

### Fase 1: Perfil Biométrico y Check-in Médico
* **Onboarding:** Edad, Peso, FC Máxima, FC Reposo.
* **Fisiología:** Cálculo de las 5 Zonas de Frecuencia Cardíaca según la fórmula de Karvonen.
* **Check-in Diario:** Slider de Fatiga (1-10) y Dolor Articular (1-10) al inicio. **Lógica de Bloqueo:** Si Dolor > 7, la app desactiva la sesión de impacto (running), sugiere crosstraining (bici/nadar) y lanza alerta de descanso activo.

### Fase 2: Gestor de Eventos y Estados UI
* CRUD de Eventos: Tipo (10k, Maratón, Fuerza, Hyrox), Prioridad (A, B, C) y Fecha.
* **Manejo de Estados (Obligatorio):** Toda vista que requiera procesar datos o llamar a la IA debe implementar estados visuales claros: `isLoading` (Spinner), `isError` (Mensaje de fallo), `isEmpty` (Mensajes como "Añade tu primer evento").

### Fase 3: Motor de IA (Gemini) - [NÚCLEO CRÍTICO]
* **Seguridad JSON (Sanitizer):** La IA de Gemini devuelve a menudo el texto envuelto en markdown. Debes implementar una función `parseAIResponse(text)` que use expresiones regulares (`Regex`) para eliminar ```json y ``` antes de hacer `JSON.parse()`. Esto es innegociable para evitar crashes.

#### EL SYSTEM PROMPT MAESTRO (Configurar en el servicio de IA):
"Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un plan semanal estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A en los próximos 14 días, reduce el volumen de entrenamiento un 30-50% progresivamente.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura: 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Strength, Rest, Crosstraining), 'durationMinutes' (number), 'targetHRZone' (string) y 'coachNotes' (string)."

#### EL USER PROMPT DINÁMICO (Que se enviará a Gemini):
"Atleta de [X] años. FC Reposo: [X]. Fatiga: [X]/10. Dolor articular: [X]/10.
Eventos próximos: [Lista de DB]. Disponibilidad semanal: [X] run, [X] fuerza.
Genera el plan de entrenamiento en JSON."

### Fase 4: Tracker de Entrenamiento
* Tracking con `expo-location` para registrar ruta y ritmos.

## 4. UI/UX
* **Tema:** Dark Mode Obligatorio.
* **Estilos:** Uso de `NativeWind` (TailwindCSS para React Native). Diseño minimalista, limpio, tarjetas redondeadas y sombras suaves.

## 5. Instrucciones Obligatorias para Trae IDE (El Agente)
Actúa como un Senior React Native Architect. Cumple esto al 100%:
1. **Entrega de Archivos:** Escribe SIEMPRE el código íntegro, sin omitir partes con comentarios tipo `// ...resto del código`.
2. **Preservación:** No elimines código ni funciones que ya operen correctamente si no estamos trabajando en ellas.
3. **Control de Errores:** Usa `try-catch` exhaustivamente, especialmente en el parseo del JSON y al acceder a SecureStore/SQLite.
4. **Comunicaciones:** Explícame los pasos técnicos en español, pero escribe los nombres de variables, componentes y commits en inglés.
5. **Protocolo de Commits:** - Al finalizar un hito lógico, detente y dime: "Es momento de hacer un commit".
   - Dame el mensaje exacto usando *Conventional Commits* (ej: `feat(ai): implement json sanitizer and gemini prompts`).
6. **Inicio del Proyecto:** Empieza configurando el `package.json`, `app.json` (permisos), la estructura de carpetas (`src/components`, `src/services`, etc.), y la base de datos SQLite. Pregúntame antes de avanzar a la Fase 1.
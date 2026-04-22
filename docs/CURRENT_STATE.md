# Estado Actual del Proyecto (Handoff)

Este documento contiene el contexto exacto del proyecto al finalizar la última sesión para que puedas retomar el trabajo de inmediato, o por si el contexto del chat se borra.

## 1. ¿Qué se ha resuelto y cuál es el estado actual?
- **App 100% Funcional**: La navegación, las pestañas (tabs) y los botones vuelven a funcionar perfectamente.
- **Bug crítico eliminado**: Se arregló el error `Couldn't find a navigation context` parcheando `react-native-css-interop` (el parche está guardado en `patches/` y se aplica automáticamente al instalar dependencias gracias al script postinstall).
- **Consolidación Visual**: Se eliminó el soporte de modo claro/dinámico. **Toda la app ahora está forzada a Tema Oscuro** para garantizar estabilidad visual y evitar bugs de estilos dinámicos. La pantalla de Calendario ya refleja este tema.
- **Seguridad IA**: La API Key de Gemini ya no está expuesta ni hardcodeada en el código. Se lee desde el archivo `.env` local (no trackeado por Git para evitar baneos de Google) o mediante `expo-secure-store`.
- **Typing Limpio**: La compilación TypeScript (`npx tsc`) se ejecuta sin errores. Se sanearon los tipos de navegación, base de datos e internacionalización (i18n).

## 2. Cómo empezar a trabajar en la nueva tarea
1. Lee tu **Sprint README** (`docs/sprint-01/README.md`) para recordar el objetivo global y lo que se ha avanzado.
2. Todo tu entorno local está limpio y ya está subido (Pushed) a la rama `main` de GitHub.
3. Para evitar que la caché de Metro te juegue malas pasadas (ya que parcheamos dependencias base), te recomiendo arrancar el proyecto limpiando caché:
   ```bash
   npx expo start -c
   ```

## 3. Reglas Críticas para el Desarrollo y Git (¡IMPORTANTE!)
Para no perder el control de los cambios como nos pasó en la sesión anterior (donde llegamos a tener +25 archivos modificados sin control), aplica siempre esto:

- **Haz Commits Frecuentes, Atómicos y Pequeños**:
  - No acumules muchos cambios locales sin trackear. Cada vez que consigas que una función, pantalla o pequeño arreglo funcione y compile, **haz un commit de inmediato**.
  - Ejemplo: Si terminas de maquetar la pantalla X -> `git add .` -> `git commit -m "feat: añadir diseño base de la pantalla X"`.
- **Prueba siempre antes de avanzar**:
  - Si vas a hacer un refactor grande o a instalar un paquete nuevo, asegúrate de que tu árbol de trabajo esté limpio (`git status` vacío). Así, si rompes algo, podrás volver atrás instantáneamente con `git restore .`.
- **Ojo con los cambios en dependencias**:
  - React Native y Expo pueden ser muy sensibles a cambios en el `package.json`. Si instalas algo nuevo y la navegación o la UI se rompen, haz un `git checkout` de tu `package.json`, borra `node_modules` y vuelve a ejecutar `npm install`.
- **Documenta tus avances**:
  - Mantén actualizado este documento (`docs/CURRENT_STATE.md`) cuando cierres una sesión importante para no perder contexto.
  - Mantén también actualizado `docs/versioning/VERSIONING.md` para reflejar cambios funcionales, fixes y decisiones de producto relevantes.

## 4. Trabajo Pendiente Recomendado
- Sincronización real con Apple HealthKit / Google Fit aún está pendiente (actualmente se está usando un Mock).
- Exportación del plan de entrenamiento a formato `.ics` para el calendario del móvil.

## 5. Ideas y Siguientes Pasos (Product Backlog)

Basado en el objetivo principal de GoalsApp, aquí tienes el backlog de funcionalidades clave que marcarán la diferencia en los próximos sprints:

### Alta Prioridad (Retención y Fricción Cero)
- **Sincronización Bidireccional (Apple Health / Google Fit)**: Leer automáticamente entrenamientos, pasos y frecuencia cardíaca para marcar las sesiones de GoalsApp como completadas sin intervención manual. (Actualmente pendiente de implementar el enlace real, usamos mock).
- **Notificaciones Locales (Push)**: Programar recordatorios nativos en el dispositivo (sin servidor) para asegurar la constancia: *"⏰ No olvides tu Check-In diario"* o *"🏃‍♂️ Hoy toca: Fuerza (45 min)"*.

### Media Prioridad (Diferenciación y Gamificación)
- **El Coach Proactivo (IA Automática)**: Hacer que Gemini analice silenciosamente los Check-ins diarios. Si detecta alta fatiga o días saltados, la app debe lanzar un popup sugiriendo proactivamente un reajuste del plan (ej: *"He visto que estás muy cansado. ¿Cambio las series de hoy por recuperación activa?"*).
- **Micro-Objetivos y Gamificación (Rachas/Streaks)**: Implementar un sistema visual de "Rachas" (ej. "🔥 5 días seguidos cumpliendo tu plan") para fomentar la retención psicológica del usuario.

### Baja Prioridad (Experiencia Visual)
- **Widgets Nativos (iOS/Android)**: Desarrollar widgets para la pantalla de inicio del móvil que muestren el progreso semanal o el próximo entrenamiento programado, manteniendo GoalsApp siempre visible para el usuario.

*Nota: La gestión de Múltiples "Goals" ya está cubierta por la arquitectura actual de generación de planes.*

## 6. IA en Producción: cómo ofrecer IA al usuario final sin pedirle su API key

### Estado actual
- Hoy GoalsApp funciona con un enfoque **BYOK** (`Bring Your Own Key`): la app usa una API key de Gemini guardada en el dispositivo o en `.env` local.
- Esto es válido para desarrollo y testing, pero **no es la solución correcta para usuario final** porque mete fricción en onboarding y porque una key enviada desde cliente móvil/web no es un secreto real.

### Cómo debe funcionar en producto real
- El usuario final **no debe meter ninguna API key**.
- La app móvil debe hablar con **tu propio backend**.
- Ese backend llama a Gemini usando **tu credencial privada en servidor**.
- La app nunca ve la key real del proveedor.

### Arquitectura recomendada
1. La app envía una petición autenticada a un endpoint tuyo, por ejemplo:
   - `POST /ai/generate-plan`
   - `POST /ai/chat`
   - `POST /ai/proactive-coach`
2. Tu backend valida:
   - usuario autenticado
   - límites de uso
   - plan gratuito o premium
   - rate limiting / abuso
3. El backend llama a Gemini con tu key privada o con credenciales de servidor.
4. El backend devuelve a la app solo la respuesta final.

### Qué tienes que pagar realmente
- No necesitas una "mega API para aplicaciones" distinta.
- Lo normal es:
  - **pagar tú el uso de Gemini** por tokens / peticiones
  - **cobrar al usuario** mediante suscripción, límites mensuales o freemium
- Además del coste del modelo, tendrás un coste pequeño de infraestructura de backend.
- Para un MVP, el coste del backend suele ser mucho menor que el de la propia IA.

### Opciones realistas
- **Opción A - Backend ligero + Gemini API**:
  - La más simple para lanzar.
  - Puedes usar Firebase Functions, Cloud Run, Supabase Edge Functions, Vercel Functions o un backend Node sencillo.
- **Opción B - Vertex AI en Google Cloud**:
  - Más seria para producción y escalado.
  - Mejor control de credenciales, permisos, observabilidad y seguridad.
- **Opción C - BYOK como modo avanzado**:
  - Puedes mantener la opción actual solo para power users o testers.
  - No debería ser el flujo principal del producto.

### Recomendación para GoalsApp
- Para el siguiente salto de producto, lo más sensato es:
  - mover `generate-plan` y `chat` a backend
  - dejar la app sin pedir API key al usuario
  - ofrecer IA incluida en el producto con límites
- Modelo recomendado:
  - gratis con uso limitado
  - premium con más generaciones, más mensajes y coach proactivo

### Riesgos que resuelve este cambio
- elimina la fricción de pedir API key en onboarding
- evita filtraciones de credenciales del proveedor
- permite controlar costes y abuso
- te deja cambiar de modelo o proveedor sin tocar la app
- abre la puerta a monetizar de forma seria

## 7. Roadmap Priorizado

### Now
- **Coach Proactivo**
- **Adherencia / progreso visible**
- **Notificaciones locales inteligentes**
- **Consistencia de datos del perfil / check-in / plan**
- **Reducir fricción de la API key**

### Next
- **Integración real con Health / Fit**
- **Resúmenes semanales**
- **Modo objetivo / race week**
- **Gamificación con sentido**

### Later
- **Widgets**
- **Múltiples goals avanzados**
- **Exportaciones más sofisticadas**
- **Sharing social**

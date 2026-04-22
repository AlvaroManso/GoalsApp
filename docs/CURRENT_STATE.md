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
  - Tienes un archivo de versiones listo. Actualiza `docs/versioning/VERSIONING.md` cuando añadas funcionalidades clave al final de cada jornada o sesión.

## 4. Trabajo Pendiente Recomendado
- Según tus **Reglas de Usuario** (User Rules), hace falta crear la documentación arquitectónica base en `docs/architecture/keizai_architecture.md`. No existe actualmente.
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

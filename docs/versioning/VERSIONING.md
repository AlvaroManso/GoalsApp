# Versioning & Changelog

## [Unreleased] - Sprint 01

### Added
- Integración segura de la API key de Gemini (SecureStore + fallback a .env).
- Parche persistente para \eact-native-css-interop\ que soluciona los crasheos de React Navigation.
- Soporte de recarga en el \ocus\ de la pantalla de Calendario.

### Changed
- Consolidación de la interfaz a **Tema Oscuro Fijo**, eliminando el modo claro/dinámico para estabilizar la UI y la navegación.
- Refactorización de tipos en TypeScript (Navigation, DB, i18n) logrando un build type-safe.
- Reestructuración de \App.tsx\ y \AppNavigator.tsx\ para usar un único \NavigationContainer\ limpio.

### Fixed
- Error crítico: \Couldn't find a navigation context\ provocado por el motor de estilos.
- Botones de la Tab Bar y la pantalla bloqueada por remounts constantes.
- Fallo de visualización en el calendario al aplicar estilos incompatibles.
# Legislación Informática · Compendio

Compendio web de los trabajos del semestre de Legislación Informática: propuestas, carteles, análisis y videos de todos los equipos, reunidos y presentados de forma visual.

## Estado

Base técnica lista: motor de presentación (escenas, transición de iris, punto, trazo a mano) y sistema de estilos heredados de SOMA Studio. El sistema de cuentas, carga de archivos y agrupación por equipos está en diseño.

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

## Estructura

- `src/core/`: el motor. `deck` (escenas e iris), `dot` (el punto), `boil` (trazo a mano), `hud` (índice y navegación), `fx` (entradas reutilizables).
- `src/scenes/`: una escena por archivo.
- `src/content/es.js`: todo el texto.
- `src/styles/`: tokens y base (`main.css`), composición por escena (`scenes.css`).

## Despliegue

GitHub Pages mediante GitHub Actions (`.github/workflows/pages.yml`) al hacer push a `main`.

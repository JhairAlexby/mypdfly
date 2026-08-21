# Spike local de OpenCV.js

Este laboratorio valida la parte de mayor riesgo de la futura herramienta de imágenes a PDF sin conectarla a la aplicación de producción.

## Alcance

- OpenCV.js 5 ejecutado localmente dentro de un Web Worker.
- Detección de un documento mediante bordes, contornos y aproximación poligonal.
- Corrección de perspectiva con cuatro puntos.
- Filtro `document-clean` mediante umbral adaptativo.
- Cinco ejecuciones consecutivas para observar tiempo y crecimiento del heap WASM.
- Cancelación mediante terminación del worker y recuperación en un worker nuevo.
- Memoria del navegador mediante `measureUserAgentSpecificMemory` o `performance.memory` cuando el navegador lo permita.
- Medición raw, gzip y Brotli del build aislado.

No genera PDF todavía ni modifica el editor. La portada enlaza a este laboratorio como una entrada separada (`/experiments/image-scanner/`), manteniendo OpenCV fuera del bundle inicial de la aplicación.

## Ejecución

```bash
pnpm experiment:image-scanner:typecheck
pnpm experiment:image-scanner:test
pnpm experiment:image-scanner:build
pnpm experiment:image-scanner:audit
pnpm experiment:image-scanner
```

El servidor de desarrollo habilita aislamiento de origen para que Chromium pueda ofrecer su medición de memoria detallada cuando esté disponible. Abre la URL mostrada por Vite y presiona **Ejecutar suite completa**; `?autorun=1` inicia la suite automáticamente.

## Criterios del fixture reproducible

- Se encuentra un cuadrilátero y se aplica perspectiva.
- El error medio de sus esquinas es inferior al 6% de la diagonal del fixture.
- El filtro produce píxeles negros y una mayoría blanca.
- La operación larga se cancela después de entrar a la etapa de filtrado.
- Una ejecución nueva termina correctamente después de cancelar.

Los umbrales solo califican el fixture del spike; no son todavía límites de producción ni prueban imágenes reales diversas.

Los valores medidos, el alcance por navegador y el veredicto técnico están en [results.md](./results.md).

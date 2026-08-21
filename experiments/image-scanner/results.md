# Resultados del spike local de OpenCV.js

Fecha de ejecución: 2026-08-20 (`America/Mexico_City`)  
Reporte del navegador: `2026-08-21T02:41:19.131Z`

## Veredicto

**Aprobado para continuar con la arquitectura, condicionado a optimizar el costo del runtime antes de producción.**

OpenCV.js 5.0.0 pudo cargarse completamente desde un chunk local dentro de un Web Worker, detectar el documento del fixture, corregir su perspectiva, aplicar el filtro `document-clean`, cancelar una operación síncrona terminando el worker y procesar nuevamente en un worker limpio.

No se recomienda incorporar el paquete genérico actual directamente al bundle principal ni conservar el worker vivo durante toda la sesión: el chunk pesa 14.86 MiB raw y el primer worker elevó en 266.65 MiB la memoria atribuida a la página.

## Entorno realmente probado

- macOS reportado por el navegador como `Macintosh; Intel Mac OS X 10_15_7`.
- Chromium `151.0.0.0` mediante el navegador integrado de Codex.
- Página servida desde `127.0.0.1` con aislamiento de origen.
- OpenCV.js `5.0.0-release.2`, empaquetado en `@opencvjs/worker` y cargado sin CDN.
- Fixture RGBA de `1280 × 900` (`1,152,000` píxeles).

Capacidades observadas: Web Worker, WebAssembly, `createImageBitmap`, `OffscreenCanvas`, `crossOriginIsolated`, `performance.memory` y `measureUserAgentSpecificMemory` disponibles.

## Calidad funcional

| Medición | Resultado |
| --- | ---: |
| Documento detectado | Sí |
| Confianza heurística | 53.1% |
| Error medio de esquinas | 2.96 px |
| Error respecto a la diagonal | 0.189% |
| Salida corregida | 874 × 618 |
| Perspectiva aplicada | Sí |
| Píxeles negros tras el filtro | 9.57% |
| Píxeles blancos tras el filtro | 90.43% |

La inspección visual confirmó que el contorno verde coincide con el papel inclinado y que la salida conserva las líneas y el sello después de enderezar y binarizar la página. No hubo errores ni advertencias en la consola del navegador.

## Rendimiento

Primera ejecución, incluyendo inicialización de OpenCV:

| Etapa | Tiempo |
| --- | ---: |
| Carga de OpenCV.js/WASM | 589.35 ms |
| Detección | 153.78 ms |
| Perspectiva | 99.25 ms |
| Filtro adaptativo | 700.50 ms |
| Total observado | 1,552.59 ms |

Cinco ejecuciones posteriores con el worker ya inicializado: `997.46`, `1,023.60`, `1,011.19`, `988.51` y `988.26 ms`; promedio `1,001.80 ms`.

Estos valores describen el fixture y este navegador. Todavía no constituyen un presupuesto para fotografías reales de mayor resolución.

## Memoria

Medida con `performance.measureUserAgentSpecificMemory()`:

| Punto | Memoria atribuida |
| --- | ---: |
| Antes de cargar OpenCV | 10.71 MiB |
| Después de la primera ejecución | 277.37 MiB |
| Después de cinco repeticiones adicionales | 279.56 MiB |
| Después de terminar el worker | 18.98 MiB |

- Costo inicial observado del worker: `+266.65 MiB`.
- Crecimiento durante cinco repeticiones: `+2.20 MiB`.
- Memoria por encima de la línea base después de `terminate()`: `+8.27 MiB`.

El runtime no expuso `HEAPU8`/`HEAP8` a través del API modularizado, por lo que no fue posible separar directamente el heap WASM. La medición del navegador sí incluye el worker y demostró que terminarlo recupera la mayor parte de la memoria.

## Cancelación

- La cancelación se solicitó después de recibir la etapa `filtering`, cuando OpenCV ya había iniciado trabajo síncrono.
- Latencia observada desde `AbortController.abort()` hasta el rechazo: `0.57 ms`.
- El worker fue terminado, no se intentó interrumpir una función síncrona mediante mensajes.
- Una ejecución nueva creó otro worker, volvió a cargar OpenCV y terminó correctamente.

## Bundle aislado

Build de Vite `8.2.1`:

| Artefacto | Raw | Gzip | Brotli nivel 6 |
| --- | ---: | ---: | ---: |
| `opencv.worker-B_O8Ai61.js` | 15,578,807 B (14.86 MiB) | 3,900,824 B (3.72 MiB) | 3,375,594 B (3.22 MiB) |
| JavaScript de la interfaz | 10,946 B | 4,650 B | 4,467 B |
| Build completo | 15,595,397 B | 3,907,913 B | 3,382,205 B |

El WASM está embebido en el archivo del worker. No existe una petición a CDN ni un `.wasm` remoto, pero esta variante incluye mucho más OpenCV de lo que necesita la futura herramienta.

## Navegadores objetivo

| Objetivo | Estado del spike |
| --- | --- |
| Chromium de escritorio | Validado realmente en Chrome 151 |
| Chrome Android | Objetivo primario; pendiente ejecutar este mismo laboratorio en dispositivo real |
| Firefox de escritorio | Objetivo secundario; pendiente validación real |
| Safari macOS e iOS | Objetivo secundario; pendiente validación real, especialmente memoria y worker modular |
| WebViews antiguos | Fuera de alcance |

La política propuesta para producción es soportar las dos versiones estables más recientes de Chrome/Edge/Firefox y la versión actual y anterior de Safari. La funcionalidad no debe depender de la API de memoria: cuando no exista, el reporte debe marcarla como no disponible sin impedir el procesamiento.

## Decisiones para la implementación real

1. Mantener OpenCV en un chunk diferido exclusivo de `image-to-pdf`.
2. Construir o fijar una variante mínima con únicamente `core` e `imgproc`; comparar tamaño y memoria contra este baseline.
3. Permitir un solo worker de procesamiento de alta resolución.
4. Terminar el worker al cancelar y después de una exportación o de un periodo corto de inactividad; no conservar sus aproximadamente 267 MiB durante toda la sesión.
5. Mantener el ajuste manual de esquinas como fallback obligatorio.
6. Usar el mismo pipeline para preview y exportación, cambiando solo la resolución.
7. Validar la siguiente etapa con un corpus de fotos reales: iluminación desigual, fondos claros/oscuros, sombras, documentos parciales y casos sin documento.

## Límites de este resultado

- El fixture es sintético y deliberadamente detectable; no prueba precisión de producción.
- Solo se ejecutó realmente en un navegador Chromium disponible en este entorno.
- No se generó un PDF porque el ensamblado pertenece a una etapa posterior.
- No se comparó todavía una compilación mínima de OpenCV ni alternativas más ligeras.

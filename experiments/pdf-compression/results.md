# Resultados del experimento PDF

Ejecución: 2026-08-19 03:55 UTC  
Entorno: macOS x64, Node.js 25.2.1  
Muestras: una ejecución aislada por cada combinación de corpus y método

## Resultado cuantitativo

`RSS pico` es el máximo total del proceso. `Δ RSS` es el incremento sobre la línea base tomada después de cargar las dependencias. El tiempo incluye lectura, procesamiento y escritura, pero excluye la auditoría posterior.

| Corpus | Método | Entrada | Salida | Reducción | Tiempo | RSS pico | Δ RSS | MAE RGB | PSNR |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Texto/vector | Estructural | 11,687 B | 6,861 B | 41.29% | 26.75 ms | 272.52 MiB | 0.43 MiB | 0 | 99.00 dB* |
| Texto/vector | Visual equilibrado | 11,687 B | 725,956 B | -6,111.65% | 1,004.70 ms | 490.65 MiB | 214.97 MiB | 3.486 | 27.17 dB |
| Texto/vector | Visual agresivo | 11,687 B | 269,802 B | -2,208.57% | 950.95 ms | 486.83 MiB | 215.00 MiB | 2.485 | 33.33 dB |
| Escaneo fotográfico | Estructural | 2,502,639 B | 2,502,062 B | 0.02% | 32.71 ms | 246.92 MiB | 1.98 MiB | 0 | 99.00 dB* |
| Escaneo fotográfico | Visual equilibrado | 2,502,639 B | 1,029,951 B | 58.85% | 1,838.95 ms | 458.63 MiB | 209.09 MiB | 8.265 | 27.61 dB |
| Escaneo fotográfico | Visual agresivo | 2,502,639 B | 287,918 B | 88.50% | 1,798.66 ms | 471.17 MiB | 223.34 MiB | 10.251 | 25.89 dB |
| Contenido mixto | Estructural | 917,712 B | 915,647 B | 0.23% | 34.40 ms | 248.50 MiB | 2.71 MiB | 0 | 99.00 dB* |
| Contenido mixto | Visual equilibrado | 917,712 B | 279,687 B | 69.52% | 2,375.96 ms | 499.69 MiB | 229.48 MiB | 1.605 | 35.37 dB |
| Contenido mixto | Visual agresivo | 917,712 B | 88,531 B | 90.35% | 2,528.79 ms | 495.87 MiB | 226.45 MiB | 1.851 | 36.22 dB |
| Formulario | Estructural | 7,430 B | 4,569 B | 38.51% | 38.13 ms | 244.57 MiB | 0.41 MiB | 0 | 99.00 dB* |
| Formulario | Visual equilibrado | 7,430 B | 50,101 B | -574.31% | 1,169.18 ms | 482.42 MiB | 212.49 MiB | 0.467 | 33.97 dB |
| Formulario | Visual agresivo | 7,430 B | 22,559 B | -203.62% | 1,176.92 ms | 482.39 MiB | 212.47 MiB | 0.246 | 41.93 dB |

\* El valor 99 dB representa error cuadrático cero en el informe; las imágenes comparadas fueron idénticas píxel por píxel.

## Pérdida funcional observada

| Corpus | Estructural | Métodos visuales |
| --- | --- | --- |
| Texto/vector | Conservó 6 páginas, geometría, 9,389 caracteres, 6 enlaces/anotaciones y título. | Conservó páginas, geometría y título; perdió el 100% del texto seleccionable y los 6 enlaces/anotaciones. |
| Escaneo fotográfico | Conservó páginas, geometría, título y píxeles. | No perdió funciones presentes porque el control no contenía texto, enlaces, anotaciones ni formularios; sí introdujo pérdida visual JPEG. |
| Contenido mixto | Conservó 4 páginas, geometría, 727 caracteres, 4 enlaces/anotaciones y título. | Conservó páginas, geometría y título; perdió el 100% del texto seleccionable y los 4 enlaces/anotaciones. |
| Formulario | Conservó 2 páginas, geometría, 211 caracteres, enlace, 3 widgets, nombres y valores de los 3 campos, y título. | Conservó páginas, geometría y título; perdió texto seleccionable, enlace, widgets y los 3 campos con sus valores. |

Los doce archivos de salida fueron analizados y renderizados nuevamente con PDF.js. La comparación funcional también abrió cada salida con `pdf-lib`; por tanto, no se detectaron archivos corruptos dentro del corpus.

## Veredicto

1. La reestructuración es el único candidato seguro para una primera integración. En este corpus fue visualmente idéntica y conservó todos los controles funcionales. Su ahorro depende de la estructura de entrada: 38.51–41.29% en documentos pequeños creados sin object streams, pero solo 0.02–0.23% cuando dominan imágenes ya comprimidas.
2. La rasterización visual no debe ser el comportamiento general. En documentos de texto o formularios aumentó el tamaño entre 203.62% y 6,111.65% y destruyó texto, enlaces y campos.
3. La rasterización sí es útil para escaneos sin contenido interactivo: redujo 58.85% en equilibrado y 88.50% en agresivo. Los métodos visuales exigieron aproximadamente 209–229 MiB adicionales de RSS en este corpus, por lo que una versión de navegador necesitaría límites de píxeles, procesamiento secuencial por página y cancelación efectiva.
4. El contenido mixto demuestra que ahorrar bytes no equivale a una salida aceptable: logró 69.52–90.35%, pero eliminó funciones. Solo sería válido como opción explícita de “aplanar documento”, con advertencia previa.
5. Toda implementación debe conservar el original cuando el resultado no sea menor. El siguiente paso recomendado es un inspector que clasifique el PDF (texto, enlaces, widgets, formularios e imágenes) y habilite primero el método estructural; la compresión visual debería quedar detrás de una decisión explícita y de criterios de elegibilidad.

## Límites

- Es un experimento controlado de una ejecución por caso, no una promesa de rendimiento ni un benchmark estadístico.
- El pico de memoria corresponde a Node.js y `@napi-rs/canvas`; el navegador debe medirse por separado antes de fijar límites de producto.
- MAE y PSNR se calcularon renderizando a 72 ppp. No sustituyen una revisión visual a distintos niveles de zoom.
- El corpus cubre los riesgos definidos, pero no incluye PDFs cifrados, firmas digitales, fuentes complejas, capas, archivos adjuntos, perfiles de color ni documentos dañados.

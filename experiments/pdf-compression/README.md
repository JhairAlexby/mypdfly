# Experimento de compresión PDF

Este laboratorio compara estrategias de compresión sin conectarlas todavía a la interfaz ni al registro de procesadores de producción.

## Corpus controlado

- `text-vector`: seis páginas con texto seleccionable, vectores y enlaces.
- `photo-scan`: tres páginas formadas exclusivamente por imágenes fotográficas.
- `mixed-content`: cuatro páginas con texto, vectores, JPEG, PNG transparente y enlaces.
- `interactive-form`: dos páginas con texto, enlace, campo de texto, casilla y lista desplegable.

Cada PDF se genera de forma determinista y con tablas de referencias clásicas (`useObjectStreams: false`) para que la optimización estructural tenga una condición inicial conocida.

## Métodos

- `structural`: vuelve a serializar el documento con `pdf-lib` y object streams, sin rasterizar páginas.
- `visual-balanced`: renderiza cada página a 1.5x y la codifica como JPEG al 78%.
- `visual-aggressive`: renderiza cada página a 1x y la codifica como JPEG al 58%.

## Métricas

- Tamaño inicial, tamaño final y porcentaje de reducción.
- Tiempo del algoritmo, excluyendo las auditorías posteriores.
- RSS y heap máximos del proceso, además del incremento respecto a la línea base.
- Conservación de páginas, geometría, texto seleccionable, anotaciones, enlaces, campos y valores de formulario, y título.
- Diferencia visual por canal RGB: error absoluto medio, PSNR e igualdad exacta de píxeles.

Cada combinación de documento y método se ejecuta en un proceso nuevo. El muestreo de memoria se realiza cada 5 ms y en los puntos de mayor asignación previstos; los resultados describen este entorno y no constituyen todavía un presupuesto para navegador.

## Ejecución

```bash
pnpm experiment:pdf:typecheck
pnpm experiment:pdf
```

La ejecución crea corpus, salidas y `report.json` en un directorio temporal. El informe consolidado y el veredicto versionados están en `results.md`.

# mypdfly

<p align="center">
  <img src="./public/logo-mypdfly.png" alt="Logo de mypdfly" width="420" />
</p>

<p align="center">
  <strong>Suite web privada, ultrarrápida y 100% local en tu navegador para editar, comprimir y convertir documentos PDF e imágenes.</strong>
</p>

<p align="center">
  <a href="https://github.com/JhairAlexby/mypdfly/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="Licencia MIT" />
  </a>
  <a href="https://github.com/JhairAlexby/mypdfly">
    <img src="https://img.shields.io/badge/GitHub-JhairAlexby%2Fmypdfly-181717?logo=github" alt="Repositorio en GitHub" />
  </a>
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
</p>

---

## ¿Qué es mypdfly?

**mypdfly** es una suite de herramientas web de alto rendimiento para trabajar con documentos PDF e imágenes sin comprometer tu privacidad. A diferencia de las soluciones convencionales en la nube, mypdfly procesa **el 100% de los archivos directamente en el navegador** del usuario mediante WebAssembly, Web Workers y la API de Canvas. 

Tus archivos nunca se suben a ningún servidor externo, no requieren crear cuentas ni pagar suscripciones, y no contienen marcas de agua.

---

## Herramientas y Funcionalidades

mypdfly organiza sus capacidades en tres herramientas principales accesibles desde una interfaz modular y optimizada:

### 1. 📄 Editor de PDF (`/editor-pdf`)
Editor visual e interactivo para visualizar, anotar, firmar y reorganizar documentos:
- **Visualización fluida:** Renderizado rápido de documentos PDF mediante PDF.js.
- **Edición y adición de texto:** Inserta textos con control tipográfico, tamaño, colores, alineación, negrita, cursiva y subrayado.
- **Formas geométricas y trazos:** Dibuja rectángulos, círculos/elipses, triángulos, líneas y flechas con ajuste de color, grosor y opacidad.
- **Censura y difuminado (Blur):** Oculta información confidencial o sensible aplicando filtros de desenfoque con intensidad configurable.
- **Firma manuscrita digital:** Dibuja firmas con mouse, touchpad, lápiz óptico o pantalla táctil e insértalas en cualquier posición del documento.
- **Fusión y combinación de PDFs:** Agrega múltiples archivos PDF en un solo proyecto de trabajo.
- **Gestión visual de páginas:** Reorganiza páginas arrastrándolas (drag & drop), rótalas en 90° o elimina páginas no deseadas.
- **Exportación versátil:** Descarga tu documento editado como PDF, páginas individuales en PNG o JPEG, o un archivo ZIP con todas las imágenes. Incluye barra de progreso y opción de cancelación.
- **Modo de pantalla completa:** Espacio de trabajo inmersivo y sin distracciones.

### 2. 🗜️ Compresor de Archivos (`/comprimir-pdf`)
Optimización inteligente de tamaño para documentos e imágenes:
- **Soporte multiformato:** Optimiza archivos PDF e imágenes en formatos JPG/JPEG, PNG, WebP y AVIF.
- **Procesamiento por lotes en cola:** Sube múltiples archivos simultáneamente; se procesan de forma secuencial mostrando el progreso individual y global.
- **Control fino de compresión:**
  - Selector de calidad visual para PDF, JPEG, WebP y AVIF.
  - Optimización PNG sin pérdida impulsada por el motor OxiPNG (WebAssembly).
- **Métricas en tiempo real:** Visualización instantánea del peso original, peso final obtenido y porcentaje exacto de reducción.
- **Descargas flexibles:** Descarga individual de cada archivo optimizado o descarga masiva empaquetada en un archivo `.zip`.
- **Procesamiento en Web Workers:** La compresión ocurre en hilos de fondo sin congelar la interfaz de usuario.

### 3. 🖼️ Imágenes a PDF con Escáner Inteligente (`/imagenes-a-pdf`)
Convierte fotografías, recibos, capturas y escaneos en un documento PDF estructurado:
- **Detección automática de esquinas:** Algoritmos de visión artificial basados en OpenCV (Web Worker) detectan los bordes de documentos automáticamente.
- **Corrección interactiva de perspectiva:** Ajusta manualmente los 4 puntos de la cuadrícula para corregir fotos tomadas con ángulo o inclinación.
- **Filtros de mejora documental:**
  - Color original optimizado.
  - Escala de grises.
  - Blanco y negro / Alto contraste (ideal para digitalizar recibos, notas y texto impreso).
- **Maquetación y maquetador de hojas:**
  - Formatos estándar: A4, Carta (US Letter) o ajuste al tamaño original de la imagen.
  - Orientación vertical (portrait) u horizontal (landscape).
  - Configuración de márgenes en milímetros (sin márgenes, estándar o personalizados).
  - Composición automática y multi-imagen en una misma hoja.
- **Organización de páginas:** Reordena imágenes, rótalas 90° o descarta tomas antes de generar el PDF final.

### 4. 🏠 Portal Central y SEO (`/`)
- Acceso directo a cada herramienta desde la página de inicio.
- Secciones de preguntas frecuentes (FAQ) y explicaciones detalladas.
- Enrutamiento dinámico mediante React Router.
- Metadatos SEO completos (Open Graph, Twitter Cards, JSON-LD Schema.org) gestionados con React Helmet Async.

---

## Privacidad y Filosofía Local-First

```
                                  TU DISPOSITIVO (NAVEGADOR)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   Documentos / Fotos   ──►   WebAssembly / Web Workers   ──►   Documento Descargable   │
│   (PDF, PNG, JPG...)         - pdf-lib & PDF.js                (PDF / Imágenes / ZIP)  │
│                              - OpenCV.js                                               │
│                              - OxiPNG / WebP / AVIF                                    │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                       (X) BLOQUEADO
                                           │
                                           ▼
                                 Servidores Externos / Nube
                                 (Nunca reciben tus datos)
```

1. **Cero subidas a servidores:** Ningún documento o fotografía viaja por internet; se leen y procesan en la memoria RAM de tu navegador.
2. **Sin cuentas ni registros:** No necesitas proporcionar correos electrónicos ni información personal para utilizar ninguna función.
3. **Sin marcas de agua ni restricciones artificiales:** Los documentos generados son 100% limpios y tuyos.

---

## Stack Tecnológico

| Capa | Tecnologías |
| --- | --- |
| **Núcleo & UI** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| **Componentes** | [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **Navegación & SEO** | [React Router v7](https://reactrouter.com/), [React Helmet Async](https://github.com/staylor/react-helmet-async) |
| **Manipulación PDF** | [PDF.js](https://mozilla.github.io/pdf.js/) (visualización), [pdf-lib](https://pdf-lib.js.org/) (composición, edición y ensamblado) |
| **Codecs y Compresión** | [@jsquash/oxipng](https://github.com/GoogleChromeLabs/jsquash) (OxiPNG Wasm), [@jsquash/webp](https://github.com/GoogleChromeLabs/jsquash), [@jsquash/avif](https://github.com/GoogleChromeLabs/jsquash), [fflate](https://github.com/101arrowz/fflate) (empaquetado ZIP en memoria) |
| **Visión Computacional** | [OpenCV.js](https://docs.opencv.org/) vía Web Workers (`@opencvjs/worker`) para detección geométrica y transformación de perspectiva |
| **Pruebas y Calidad** | Node Test Runner con [tsx](https://github.com/privatenumber/tsx), ESLint y TypeScript |
| **Gestor de Paquetes** | [pnpm](https://pnpm.io/) |

---

## Puesta en marcha

### Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior.
- [pnpm](https://pnpm.io/) (`corepack enable pnpm` o `npm install -g pnpm`).

### Instalación

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/JhairAlexby/mypdfly.git
cd mypdfly
pnpm install
```

### Servidor de desarrollo

Inicia el entorno de desarrollo local con Hot Module Replacement (HMR):

```bash
pnpm dev
```

Abre en tu navegador la URL local indicada por Vite (habitualmente `http://localhost:5173`).

### Compilación para producción

Verifica los tipos de TypeScript y genera los archivos estáticos listos para producción:

```bash
pnpm build
```

Para previsualizar la compilación localmente:

```bash
pnpm preview
```

---

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia el servidor de desarrollo Vite con recarga rápida. |
| `pnpm build` | Comprueba tipos con `tsc` y compila la versión de producción optimizada. |
| `pnpm preview` | Sirve localmente los archivos compilados en la carpeta `dist`. |
| `pnpm lint` | Ejecuta ESLint sobre todo el proyecto para validar estándares de código. |
| `pnpm test` | Ejecuta la suite completa de pruebas unitarias y de integración (18 suites con `tsx --test`). |
| `pnpm experiment:image-scanner` | Inicia el entorno experimental para el laboratorio del escáner de imágenes. |
| `pnpm experiment:image-scanner:test` | Ejecuta pruebas específicas de geometría y cliente worker del escáner. |
| `pnpm experiment:image-scanner:build` | Compila el laboratorio experimental de escaneo. |
| `pnpm experiment:image-scanner:typecheck` | Verifica tipos TypeScript del laboratorio del escáner. |
| `pnpm experiment:pdf` | Ejecuta experimentos de compresión de PDF mediante script tsx. |
| `pnpm experiment:pdf:typecheck` | Comprueba tipos TypeScript del laboratorio de compresión PDF. |

---

## Estructura del proyecto

```text
mypdfly/
├── public/                     # Recursos estáticos públicos, logo, robots.txt y sitemap.xml
├── src/
│   ├── assets/                 # Logotipos y recursos vectoriales
│   ├── components/             # Componentes compartidos (cabecera, pie, SEO, modales, UI de shadcn)
│   ├── features/               # Módulos principales de la aplicación
│   │   ├── file-compression/   # Compresor de PDF e imágenes (codecs, workers, hooks, dashboard)
│   │   └── image-to-pdf/       # Conversor de imágenes a PDF (escáner OpenCV, perspectiva, compositor)
│   ├── lib/                    # Utilidades generales (formatos de archivo, geometría, helpers)
│   ├── pages/                  # Vistas enrutadas: HomePage, CompressPage, ImageToPdfPage, PdfEditorPage
│   ├── App.tsx                 # Enrutador principal de la aplicación
│   └── main.tsx                # Punto de entrada de la aplicación React
├── tests/                      # Pruebas automatizadas de exportación, compresión, geometría y layouts
└── experiments/                # Laboratorios experimentales aislados (escáner, compresión PDF)
```

---

## Privacidad

mypdfly fue concebido bajo el principio de soberanía de datos y arquitectura local-first. Los archivos que seleccionas y las transformaciones que realizas se ejecutan exclusivamente en la sesión de tu navegador. Ningún dato es transmitido ni recolectado por servidores remotos.

---

## Contribuir

Las contribuciones, sugerencias de nuevas características y reportes de errores son bienvenidos. Si deseas aportar:

1. Haz un fork del proyecto.
2. Crea tu rama para la funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. Confirma tus cambios (`git commit -m 'feat: agrega nueva funcionalidad'`).
4. Sube tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un Pull Request en el [repositorio de GitHub](https://github.com/JhairAlexby/mypdfly).

---

## Licencia

Este proyecto se distribuye bajo la [Licencia MIT](./LICENSE). Eres libre de usarlo, modificarlo y distribuirlo conservando el aviso de copyright y la licencia correspondiente.

---

## Hecho por

<p align="center">
  <a href="https://mictlanlabs.com.mx" target="_blank" rel="noreferrer">
    <img src="./src/assets/LogoBlack.svg" alt="Mictlán Labs" width="240" />
  </a>
</p>

<p align="center">
  Creado por <a href="https://github.com/JhairAlexby">JhairAlexby</a> · <a href="https://mictlanlabs.com.mx">MictlánLabs</a>
</p>


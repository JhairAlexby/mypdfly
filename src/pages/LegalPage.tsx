import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { SeoHead } from '@/components/SeoHead'

type LegalSection = {
  id: string
  title: string
  paragraphs: readonly string[]
}

type LegalDocument = {
  title: string
  description: string
  sections: readonly LegalSection[]
}

const documents: Record<'privacy' | 'terms', LegalDocument> = {
  privacy: {
    title: 'Política de Privacidad',
    description: 'Cómo la aplicación móvil MyPDFly, desarrollada por MictlanLabs, utiliza la cámara, procesa documentos localmente y permite eliminar tus archivos.',
    sections: [
      {
        id: 'identidad',
        title: '1. Identidad y alcance',
        paragraphs: [
          'Esta Política de Privacidad corresponde a la aplicación móvil MyPDFly, desarrollada por MictlanLabs. Describe el acceso, uso, almacenamiento y eliminación de la información al escanear documentos, estampar firmas manuscritas y generar archivos PDF.',
          'Esta política se refiere a la aplicación móvil. Su publicación en este sitio web permite consultarla públicamente, sin iniciar sesión.',
        ],
      },
      {
        id: 'camara',
        title: '2. Permiso de cámara',
        paragraphs: [
          'MyPDFly solicita tu autorización para acceder a la cámara exclusivamente cuando utilizas el escáner de documentos físicos. El acceso se utiliza en tiempo real para previsualizar, capturar y digitalizar el documento en tu dispositivo.',
          'La aplicación no transmite el flujo de video a servidores externos ni conserva grabaciones o copias ocultas en búferes persistentes. La previsualización y el procesamiento requieren memoria temporal; esa memoria no constituye un archivo de video almacenado. Las imágenes que capturas se guardan localmente para crear tus documentos.',
          'Puedes denegar o revocar el permiso de cámara desde los ajustes del sistema operativo. Sin ese permiso, la función de escaneo con cámara no estará disponible.',
        ],
      },
      {
        id: 'almacenamiento',
        title: '3. Procesamiento y almacenamiento local',
        paragraphs: [
          'Todos los archivos que la aplicación conserva para procesar tus documentos, incluidas las imágenes capturadas, los trazos de firma manuscrita y los archivos PDF finales, se almacenan única y exclusivamente en el almacenamiento local privado del dispositivo, dentro del espacio aislado de la aplicación (sandbox).',
          'MictlanLabs no mantiene copias de estos archivos en servidores ni ofrece almacenamiento o recuperación en la nube. El procesamiento de las imágenes, las firmas y los PDF se realiza en el dispositivo.',
          'Si decides exportar un documento fuera de la aplicación, la copia de destino queda bajo tu control y las condiciones del almacenamiento o servicio que elijas. Esa copia es independiente del archivo conservado en MyPDFly.',
        ],
      },
      {
        id: 'recopilacion',
        title: '4. Cero recopilación y transferencia de datos',
        paragraphs: [
          'MyPDFly NO recopila, NO almacena en la nube, NO transmite ni comparte datos personales, identificadores de dispositivo, telemetría ni el contenido de tus documentos con MictlanLabs o con terceros.',
          'El acceso local a la cámara, las imágenes y las firmas se limita a ejecutar las funciones que solicitas. No se utiliza para publicidad, seguimiento, perfiles de usuario ni análisis remoto de uso.',
        ],
      },
      {
        id: 'eliminacion',
        title: '5. Conservación y eliminación de datos',
        paragraphs: [
          'Tienes el control de tus documentos y del tiempo que permanecen en la aplicación. Al eliminar un documento dentro de MyPDFly, se elimina su copia local y los archivos asociados a ese documento; la aplicación no ofrece recuperación de los archivos eliminados. Al desinstalar MyPDFly, el sistema operativo elimina los datos del almacenamiento privado de la aplicación.',
          'La eliminación se aplica a los datos internos de MyPDFly. No elimina copias que hayas exportado ni copias de seguridad gestionadas fuera de la aplicación. Debes eliminarlas desde su ubicación o servicio correspondiente.',
          'Eliminar un archivo no equivale a garantizar la sobrescritura física inmediata e irreversible de la memoria del dispositivo. Ese comportamiento depende del sistema operativo y del hardware. MictlanLabs no puede recuperar tus documentos porque no dispone de copias de ellos.',
        ],
      },
      {
        id: 'contacto',
        title: '6. Contacto y consultas de privacidad',
        paragraphs: [
          'Para aclaraciones sobre esta política o el manejo local de tus datos, contacta con MictlanLabs mediante el correo que aparece al final de esta página.',
          'Si nos escribes voluntariamente, recibiremos tu dirección de correo y el contenido que incluyas para atender tu solicitud. Esta comunicación de soporte es independiente del procesamiento local de la aplicación. No envíes documentos, firmas ni información sensible que no sea necesaria para tu consulta.',
        ],
      },
      {
        id: 'actualizaciones',
        title: '7. Actualizaciones de esta política',
        paragraphs: ['Publicaremos cualquier modificación en esta misma página y actualizaremos la fecha visible. Si cambia el tratamiento de datos de la aplicación, informaremos de ello y solicitaremos los permisos o consentimientos que correspondan antes de realizar ese tratamiento.'],
      },
    ],
  },
  terms: {
    title: 'Términos y Condiciones',
    description: 'Condiciones de uso de la aplicación móvil MyPDFly de MictlanLabs: escaneo local, firmas, documentos PDF y responsabilidad sobre tus archivos.',
    sections: [
      {
        id: 'servicio',
        title: '1. Naturaleza del servicio',
        paragraphs: ['Estos Términos y Condiciones regulan el uso de la aplicación móvil MyPDFly, desarrollada por MictlanLabs. Al utilizarla, aceptas estas condiciones.', 'MyPDFly es una herramienta de productividad local para escanear y digitalizar documentos físicos, estampar firmas manuscritas y generar documentos en formato PDF. No es un servicio de custodia documental ni de respaldo en la nube.'],
      },
      {
        id: 'responsabilidad',
        title: '2. Responsabilidad del usuario y firmas',
        paragraphs: ['Eres el único responsable de la legitimidad, custodia y validez legal de los documentos que procesas y de las firmas que estampas. Debes contar con los derechos y autorizaciones necesarios para utilizar los documentos y las firmas, y abstenerte de falsificar identidades, alterar documentos de forma ilícita o vulnerar derechos de terceros.', 'Estampar una firma manuscrita en un PDF no certifica por sí mismo la identidad del firmante, su consentimiento, la integridad del documento ni su validez para un trámite concreto. Te corresponde comprobar los requisitos legales y los criterios de aceptación del destinatario. MyPDFly no presta asesoría legal ni servicios de certificación de firmas.'],
      },
      {
        id: 'custodia',
        title: '3. Custodia y pérdida de información',
        paragraphs: ['Debes revisar los documentos generados antes de utilizarlos y conservar las copias que necesites en una ubicación bajo tu control. Los archivos internos dependen del almacenamiento y funcionamiento de tu dispositivo.', 'En la medida permitida por la legislación aplicable, MictlanLabs no se hace responsable de la pérdida de información derivada de fallos de hardware del dispositivo, desinstalación de la aplicación o borrado accidental de datos locales. MictlanLabs no dispone de copias en la nube para restaurar estos archivos.', 'Esta limitación no excluye responsabilidades que legalmente no puedan limitarse ni afecta los derechos irrenunciables que te correspondan como usuario.'],
      },
      {
        id: 'propiedad',
        title: '4. Propiedad intelectual',
        paragraphs: ['La aplicación MyPDFly, su marca y el código desarrollado por MictlanLabs son propiedad de MictlanLabs. Los componentes de terceros conservan sus titulares y licencias respectivos; estas condiciones no restringen los derechos concedidos por las licencias de software aplicables.', 'Los derechos que te correspondan sobre el contenido de los documentos generados permanecen íntegramente contigo. MictlanLabs no adquiere derechos sobre tus documentos, imágenes o firmas por el uso de la aplicación. El uso de MyPDFly tampoco transfiere al usuario derechos sobre contenido ajeno.'],
      },
      {
        id: 'privacidad',
        title: '5. Privacidad',
        paragraphs: ['El acceso a la cámara, el procesamiento local y la eliminación de los documentos se describen en la Política de Privacidad de la aplicación móvil, disponible desde el enlace de esta página.'],
      },
      {
        id: 'cambios',
        title: '6. Cambios y contacto',
        paragraphs: ['Las modificaciones de estas condiciones se publicarán en esta URL con una fecha de actualización visible. Para consultas sobre estas condiciones o soporte de la aplicación, escribe a MictlanLabs al correo indicado a continuación.'],
      },
    ],
  },
}

const webDocuments: Record<'privacy' | 'terms', LegalDocument> = {
  privacy: {
    title: 'Política de Privacidad',
    description: 'Privacidad del sitio web MyPDFly: procesamiento en el navegador, archivos descargados y conexiones necesarias para acceder al servicio.',
    sections: [
      { id: 'alcance', title: '1. Responsable y alcance', paragraphs: ['MictlanLabs es responsable del sitio web MyPDFly, disponible en mypdfly.mictlanlabs.com.mx. Esta política corresponde exclusivamente a las herramientas web; la aplicación móvil dispone de una política independiente.', 'El sitio permite editar PDF, convertir imágenes a PDF y comprimir archivos directamente en el navegador, sin crear una cuenta.'] },
      { id: 'archivos', title: '2. Tratamiento local de documentos', paragraphs: ['Los archivos que seleccionas, las imágenes, las anotaciones y los trazos de firma se procesan en tu navegador. Las herramientas web no envían el contenido de esos archivos a MictlanLabs ni a un servidor de conversión.', 'Seleccionar un archivo permite a la herramienta leerlo para realizar la operación solicitada. Los resultados se descargan en la ubicación que elijas mediante tu navegador. MictlanLabs no conserva una copia de tus documentos ni ofrece recuperación en la nube.'] },
      { id: 'conexiones', title: '3. Acceso al sitio y datos técnicos', paragraphs: ['El procesamiento local de documentos no significa que visitar el sitio no genere conexiones de red. Para entregar la página y sus recursos, la infraestructura de alojamiento recibe datos técnicos de la solicitud, como la dirección IP y datos del navegador. Estos datos son distintos del contenido de los documentos que procesas.', 'Las herramientas web no incorporan funciones de publicidad personalizada ni seguimiento del contenido de tus documentos. Los enlaces externos, como GitHub o el sitio de MictlanLabs, se rigen por las políticas de sus respectivos destinos cuando los visitas.'] },
      { id: 'conservacion', title: '4. Almacenamiento y eliminación', paragraphs: ['El espacio de trabajo utiliza recursos locales del navegador durante el procesamiento. Cerrar o recargar la página puede descartar el trabajo que no hayas descargado. El navegador puede conservar recursos del sitio en su caché; puedes eliminarlos desde sus ajustes.', 'Las descargas y los archivos originales permanecen en las ubicaciones de tu dispositivo que tú controlas. Para eliminarlos, utiliza el administrador de archivos y, si corresponde, vacía la papelera. Cerrar la página o borrar los datos del navegador no elimina automáticamente esos archivos.', 'Si tu dispositivo sincroniza la carpeta de descargas con un servicio externo, esa sincronización depende de tu configuración y de ese proveedor. La eliminación de una copia local no garantiza la eliminación de otras copias ni la sobrescritura física de la memoria.'] },
      { id: 'contacto', title: '5. Contacto de privacidad', paragraphs: ['Puedes dirigir tus consultas de privacidad a contacto.mictlanlabs@gmail.com. Si nos escribes, recibiremos tu dirección y el contenido del mensaje para atender tu solicitud. Evita adjuntar documentos o firmas sensibles que no sean necesarios.', 'MictlanLabs no puede consultar ni recuperar los documentos procesados localmente en tu navegador.'] },
      { id: 'cambios', title: '6. Actualizaciones', paragraphs: ['Publicaremos los cambios de esta política en esta página, indicando su fecha de actualización. Los cambios relevantes en el tratamiento de datos se comunicarán y se solicitarán los consentimientos que correspondan.'] },
    ],
  },
  terms: {
    title: 'Términos y Condiciones',
    description: 'Condiciones del sitio web MyPDFly: edición y compresión de archivos, conversión de imágenes a PDF, firmas y custodia de tus descargas.',
    sections: [
      { id: 'servicio', title: '1. Uso del sitio web', paragraphs: ['Estos Términos y Condiciones regulan el uso del sitio web MyPDFly de MictlanLabs, en mypdfly.mictlanlabs.com.mx. Al utilizar sus herramientas, aceptas estas condiciones. La aplicación móvil tiene sus propios términos.', 'El sitio ofrece herramientas de productividad para editar documentos PDF, añadir anotaciones y firmas manuscritas, convertir imágenes a PDF y comprimir archivos. El procesamiento se realiza localmente en el navegador.'] },
      documents.terms.sections[1],
      { id: 'custodia', title: '3. Descargas y responsabilidad', paragraphs: ['Debes revisar la exactitud, legibilidad y contenido de los resultados antes de utilizarlos. Descarga y conserva los documentos que necesites: la página no es un servicio de custodia o respaldo.', 'La disponibilidad y capacidad de procesamiento dependen de tu navegador, la memoria disponible, el dispositivo y las características de cada archivo. Cerrar la pestaña, recargar la página o un fallo del navegador puede provocar la pérdida del trabajo no descargado.', 'En la medida permitida por la legislación aplicable, MictlanLabs no responde por pérdida de información derivada de fallos del dispositivo o navegador, cierre de la sesión de trabajo o borrado accidental de archivos. Esta limitación no excluye responsabilidades que no puedan limitarse legalmente ni derechos irrenunciables del usuario.'] },
      { id: 'propiedad', title: '4. Propiedad intelectual', paragraphs: ['La marca MyPDFly y el código desarrollado por MictlanLabs pertenecen a MictlanLabs, con sujeción a las licencias de software aplicables. Los componentes de terceros conservan sus derechos y licencias. Estas condiciones no restringen los permisos concedidos por dichas licencias.', 'Conservas íntegramente los derechos que te correspondan sobre tus documentos, imágenes y firmas. MictlanLabs no adquiere derechos sobre su contenido por el uso del sitio. Eres responsable de respetar los derechos sobre contenido de terceros.'] },
      { id: 'privacidad', title: '5. Privacidad y servicios externos', paragraphs: ['La Política de Privacidad web explica el procesamiento local de documentos y las conexiones necesarias para acceder al sitio. Puedes consultarla desde el enlace de esta página.', 'Cuando visitas un enlace externo o utilizas otro servicio para guardar tus descargas, se aplican las condiciones de ese destino.'] },
      { id: 'contacto', title: '6. Cambios y contacto', paragraphs: ['Las modificaciones se publicarán en esta página con su fecha de actualización. Para consultas sobre el sitio y estas condiciones, escribe a contacto.mictlanlabs@gmail.com.'] },
    ].filter((section): section is LegalSection => section !== undefined),
  },
}

export function LegalPage({ document, platform = 'mobile' }: { document: 'privacy' | 'terms'; platform?: 'web' | 'mobile' }) {
  const content = (platform === 'web' ? webDocuments : documents)[document]
  const prefix = platform === 'web' ? '/web' : ''
  const platformLabel = platform === 'web' ? 'Sitio web' : 'Aplicación móvil'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [document, platform])

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SeoHead title={`${content.title} · ${platformLabel} | MyPDFly — MictlanLabs`} description={content.description} canonical={`https://mypdfly.mictlanlabs.com.mx${prefix}/${document}`} />
      <a href="#contenido-legal" className="sr-only focus:not-sr-only focus:p-4 focus:underline">Saltar al contenido</a>
      <AppHeader />
      <main id="contenido-legal" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <header className="border-b border-border pb-8">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">MyPDFly · {platformLabel} · MictlanLabs</p>
          <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{content.description}</p>
          <p className="mt-5 text-sm text-muted-foreground">Última actualización: <time dateTime="2026-09-07">7 de septiembre de 2026</time></p>
        </header>
        <nav aria-label="Contenido de esta página" className="my-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="mb-3 font-semibold">En esta página</p>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {content.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`} className="flex min-h-11 items-center py-2 text-sm leading-6 underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4">{section.title}</a></li>
            ))}
          </ul>
        </nav>
        <article className="space-y-9">
          {content.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titulo`} className="scroll-mt-28">
              <h2 id={`${section.id}-titulo`} className="text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-3 text-base leading-8 text-foreground/85">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </article>
        <aside aria-label="Contacto de MictlanLabs" className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Contacto de MictlanLabs</h2>
          <a href="mailto:contacto.mictlanlabs@gmail.com" className="inline-flex min-h-11 max-w-full items-center break-all py-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">contacto.mictlanlabs@gmail.com</a>
          <p className="mt-3"><Link to={`${prefix}/${document === 'privacy' ? 'terms' : 'privacy'}`} className="inline-flex min-h-11 items-center py-2 text-sm font-medium underline underline-offset-4">{document === 'privacy' ? 'Consultar Términos y Condiciones' : 'Consultar Política de Privacidad'}</Link></p>
        </aside>
      </main>
      <AppFooter />
    </div>
  )
}

import { Helmet } from 'react-helmet-async'

export interface FaqItem {
  question: string
  answer: string
}

export interface WebApplicationSchema {
  name: string
  description: string
  url?: string
}

export interface SeoHeadProps {
  title: string
  description: string
  canonical: string
  ogImage?: string
  webApplication?: WebApplicationSchema
  faqs?: FaqItem[]
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

export function SeoHead({
  title,
  description,
  canonical,
  ogImage = 'https://mypdfly.mictlanlabs.com.mx/logo-mypdfly.png',
  webApplication,
  faqs,
  jsonLd,
}: SeoHeadProps) {
  const schemas: Array<Record<string, unknown>> = []

  if (webApplication) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: webApplication.name,
      description: webApplication.description,
      url: webApplication.url || canonical,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    })
  }

  if (faqs && faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    })
  }

  if (jsonLd) {
    if (Array.isArray(jsonLd)) {
      schemas.push(...jsonLd)
    } else {
      schemas.push(jsonLd)
    }
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}

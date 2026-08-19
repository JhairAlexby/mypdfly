export type PdfExperimentMethodId =
  | 'structural'
  | 'visual-balanced'
  | 'visual-aggressive'

export type PdfFixtureId =
  | 'text-vector'
  | 'photo-scan'
  | 'mixed-content'
  | 'interactive-form'

export type PdfExperimentFixture = {
  readonly id: PdfFixtureId
  readonly label: string
  readonly path: string
}

export type PdfExperimentMethod = {
  readonly id: PdfExperimentMethodId
  readonly label: string
  readonly kind: 'structural' | 'visual'
  readonly jpegQuality?: number
  readonly renderScale?: number
}

export type PdfFormFieldAudit = {
  readonly name: string
  readonly type: string
  readonly value: string
}

export type PdfDocumentAudit = {
  readonly annotationCount: number
  readonly annotationTypes: Readonly<Record<string, number>>
  readonly formFields: readonly PdfFormFieldAudit[]
  readonly linkTargets: readonly string[]
  readonly pageCount: number
  readonly pageSizes: readonly {
    readonly height: number
    readonly width: number
  }[]
  readonly textCharacters: number
  readonly textHash: string
  readonly title: string | null
}

export type PdfFunctionalComparison = {
  readonly annotationsPreserved: boolean
  readonly formFieldsPreserved: boolean
  readonly linksPreserved: boolean
  readonly pageCountPreserved: boolean
  readonly pageGeometryPreserved: boolean
  readonly textCharactersPreservedRatio: number
  readonly textContentPreserved: boolean
  readonly titlePreserved: boolean
}

export type PdfVisualComparison = {
  readonly meanAbsoluteError: number
  readonly pixelIdentical: boolean
  readonly psnrDb: number
}

export type PdfExperimentMeasurement = {
  readonly durationMs: number
  readonly finalHeapUsedBytes: number
  readonly finalRssBytes: number
  readonly peakHeapDeltaBytes: number
  readonly peakHeapUsedBytes: number
  readonly peakRssBytes: number
  readonly peakRssDeltaBytes: number
}

export type PdfExperimentResult = {
  readonly fixtureId: PdfFixtureId
  readonly fixtureLabel: string
  readonly functional: PdfFunctionalComparison
  readonly inputAudit: PdfDocumentAudit
  readonly inputSize: number
  readonly measurement: PdfExperimentMeasurement
  readonly methodId: PdfExperimentMethodId
  readonly methodLabel: string
  readonly outputAudit: PdfDocumentAudit
  readonly outputPath: string
  readonly outputSize: number
  readonly reductionPercentage: number
  readonly visual: PdfVisualComparison
}

export type PdfExperimentReport = {
  readonly artifactDirectory: string
  readonly environment: {
    readonly architecture: string
    readonly node: string
    readonly platform: string
  }
  readonly generatedAt: string
  readonly results: readonly PdfExperimentResult[]
  readonly workspacePath: string
}

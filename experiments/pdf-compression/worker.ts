import { stat } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

import {
  auditPdfDocument,
  comparePdfFunctionality,
  comparePdfVisuals,
} from './audit.ts'
import { runPdfCompressionMethod } from './methods.ts'
import type {
  PdfExperimentMethodId,
  PdfExperimentResult,
  PdfFixtureId,
} from './types.ts'

type PdfExperimentJob = {
  readonly fixtureId: PdfFixtureId
  readonly fixtureLabel: string
  readonly inputPath: string
  readonly methodId: PdfExperimentMethodId
  readonly outputPath: string
}

const RESULT_PREFIX = 'PDF_EXPERIMENT_RESULT='

const parseJob = (): PdfExperimentJob => {
  const serializedJob = process.argv[2]
  if (!serializedJob) throw new Error('Falta la definición del trabajo PDF')
  return JSON.parse(serializedJob) as PdfExperimentJob
}

const run = async () => {
  const job = parseJob()
  globalThis.gc?.()

  const baseline = process.memoryUsage()
  let peakHeapUsedBytes = baseline.heapUsed
  let peakRssBytes = baseline.rss
  const sampleMemory = () => {
    const current = process.memoryUsage()
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, current.heapUsed)
    peakRssBytes = Math.max(peakRssBytes, current.rss)
  }
  const interval = setInterval(sampleMemory, 5)
  const startedAt = performance.now()

  let method
  try {
    method = await runPdfCompressionMethod(
      job.inputPath,
      job.outputPath,
      job.methodId,
      sampleMemory,
    )
  } finally {
    sampleMemory()
    clearInterval(interval)
  }

  const finishedAt = performance.now()
  const finalMemory = process.memoryUsage()
  peakHeapUsedBytes = Math.max(peakHeapUsedBytes, finalMemory.heapUsed)
  peakRssBytes = Math.max(peakRssBytes, finalMemory.rss)

  const [inputFile, outputFile, inputAudit, outputAudit, visual] =
    await Promise.all([
      stat(job.inputPath),
      stat(job.outputPath),
      auditPdfDocument(job.inputPath),
      auditPdfDocument(job.outputPath),
      comparePdfVisuals(job.inputPath, job.outputPath),
    ])

  const result: PdfExperimentResult = {
    fixtureId: job.fixtureId,
    fixtureLabel: job.fixtureLabel,
    functional: comparePdfFunctionality(inputAudit, outputAudit),
    inputAudit,
    inputSize: inputFile.size,
    measurement: {
      durationMs: Math.round((finishedAt - startedAt) * 100) / 100,
      finalHeapUsedBytes: finalMemory.heapUsed,
      finalRssBytes: finalMemory.rss,
      peakHeapDeltaBytes: Math.max(
        0,
        peakHeapUsedBytes - baseline.heapUsed,
      ),
      peakHeapUsedBytes,
      peakRssBytes,
      peakRssDeltaBytes: Math.max(0, peakRssBytes - baseline.rss),
    },
    methodId: method.id,
    methodLabel: method.label,
    outputAudit,
    outputPath: job.outputPath,
    outputSize: outputFile.size,
    reductionPercentage:
      Math.round((1 - outputFile.size / inputFile.size) * 10_000) / 100,
    visual,
  }

  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`)
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

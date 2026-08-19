import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createControlledPdfFixtures } from './fixtures.ts'
import { PDF_EXPERIMENT_METHODS } from './methods.ts'
import type {
  PdfExperimentReport,
  PdfExperimentResult,
  PdfExperimentMethodId,
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
const experimentDirectory = dirname(fileURLToPath(import.meta.url))
const workspacePath = resolve(experimentDirectory, '../..')
const workerPath = join(experimentDirectory, 'worker.ts')

const runIsolatedJob = (job: PdfExperimentJob) =>
  new Promise<PdfExperimentResult>((resolveJob, rejectJob) => {
    const child = spawn(
      process.execPath,
      [
        '--expose-gc',
        '--import',
        'tsx',
        workerPath,
        JSON.stringify(job),
      ],
      {
        cwd: workspacePath,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', rejectJob)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectJob(
          new Error(
            `Falló ${job.fixtureId}/${job.methodId} (código ${code}).\n${stderr || stdout}`,
          ),
        )
        return
      }

      const resultLine = stdout
        .split('\n')
        .find((line) => line.startsWith(RESULT_PREFIX))
      if (!resultLine) {
        rejectJob(
          new Error(
            `El trabajo ${job.fixtureId}/${job.methodId} no devolvió resultados.\n${stderr || stdout}`,
          ),
        )
        return
      }

      resolveJob(
        JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as PdfExperimentResult,
      )
    })
  })

const formatMegabytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(2)} MB`

const printResult = (result: PdfExperimentResult) => {
  const functionalFailures = [
    result.functional.annotationsPreserved,
    result.functional.formFieldsPreserved,
    result.functional.linksPreserved,
    result.functional.pageCountPreserved,
    result.functional.pageGeometryPreserved,
    result.functional.textContentPreserved,
    result.functional.titlePreserved,
  ].filter((preserved) => !preserved).length

  console.log(
    [
      result.fixtureId.padEnd(17),
      result.methodId.padEnd(18),
      `${result.reductionPercentage.toFixed(2)}%`.padStart(9),
      `${result.measurement.durationMs.toFixed(2)} ms`.padStart(12),
      formatMegabytes(result.measurement.peakRssDeltaBytes).padStart(10),
      `${functionalFailures} fallos`,
      `PSNR ${result.visual.psnrDb.toFixed(2)} dB`,
    ].join(' | '),
  )
}

const run = async () => {
  const artifactDirectory = await mkdtemp(
    join(tmpdir(), 'mypdfly-pdf-experiment-'),
  )
  const fixtureDirectory = join(artifactDirectory, 'fixtures')
  const outputDirectory = join(artifactDirectory, 'outputs')
  await Promise.all([
    mkdir(fixtureDirectory, { recursive: true }),
    mkdir(outputDirectory, { recursive: true }),
  ])

  console.log(`Generando corpus controlado en ${artifactDirectory}`)
  const fixtures = await createControlledPdfFixtures(fixtureDirectory)
  const results: PdfExperimentResult[] = []

  for (const fixture of fixtures) {
    for (const method of PDF_EXPERIMENT_METHODS) {
      console.log(`Ejecutando ${fixture.id} / ${method.id}...`)
      const result = await runIsolatedJob({
        fixtureId: fixture.id,
        fixtureLabel: fixture.label,
        inputPath: fixture.path,
        methodId: method.id,
        outputPath: join(
          outputDirectory,
          `${fixture.id}--${method.id}.pdf`,
        ),
      })
      results.push(result)
      printResult(result)
    }
  }

  const report: PdfExperimentReport = {
    artifactDirectory,
    environment: {
      architecture: process.arch,
      node: process.version,
      platform: process.platform,
    },
    generatedAt: new Date().toISOString(),
    results,
    workspacePath,
  }
  const reportPath = join(artifactDirectory, 'report.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)

  console.log(`Informe JSON: ${reportPath}`)
  process.stdout.write(`PDF_EXPERIMENT_REPORT=${JSON.stringify(report)}\n`)
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

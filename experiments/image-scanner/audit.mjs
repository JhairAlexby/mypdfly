import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const outputDirectory = path.resolve(
  import.meta.dirname,
  '../../dist/image-scanner-spike',
)

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )

  return nestedFiles.flat()
}

const files = await listFiles(outputDirectory)
const measurements = []
for (const filePath of files) {
  const fileBuffer = await readFile(filePath)
  const fileStat = await stat(filePath)
  measurements.push({
    brotliBytes: brotliCompressSync(fileBuffer, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 6,
      },
    }).byteLength,
    gzipBytes: gzipSync(fileBuffer, { level: 9 }).byteLength,
    path: path.relative(outputDirectory, filePath),
    rawBytes: fileStat.size,
  })
}
measurements.sort((first, second) => second.rawBytes - first.rawBytes)

const totals = measurements.reduce(
  (current, measurement) => ({
    brotliBytes: current.brotliBytes + measurement.brotliBytes,
    gzipBytes: current.gzipBytes + measurement.gzipBytes,
    rawBytes: current.rawBytes + measurement.rawBytes,
  }),
  { brotliBytes: 0, gzipBytes: 0, rawBytes: 0 },
)

process.stdout.write(
  `${JSON.stringify(
    {
      files: measurements,
      largestJavaScriptAsset:
        measurements.find((measurement) => measurement.path.endsWith('.js')) ??
        null,
      outputDirectory,
      totals,
    },
    null,
    2,
  )}\n`,
)

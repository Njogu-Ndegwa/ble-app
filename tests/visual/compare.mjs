// Pixel-diff a capture directory against the baseline.
//
// Usage:
//   node tests/visual/compare.mjs tests/visual-baseline tests/visual-current [--threshold 0.001]
//
// Writes diff images next to a report at <currentDir>/diff-report.txt and
// exits 1 if any pair differs by more than the threshold (fraction of pixels).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const [baseDir, currDir] = process.argv.slice(2)
if (!baseDir || !currDir) {
  console.error('Usage: node tests/visual/compare.mjs <baselineDir> <currentDir> [--threshold 0.001]')
  process.exit(2)
}
const tIdx = process.argv.indexOf('--threshold')
const THRESHOLD = tIdx >= 0 ? Number(process.argv[tIdx + 1]) : 0.001 // 0.1% of pixels

const diffDir = join(currDir, 'diffs')
mkdirSync(diffDir, { recursive: true })

let failures = 0
const lines = []

function* pngFiles(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== 'diffs') yield* pngFiles(join(dir, entry.name), join(prefix, entry.name))
    } else if (entry.name.endsWith('.png')) {
      yield join(prefix, entry.name)
    }
  }
}

for (const rel of pngFiles(baseDir)) {
  const basePath = join(baseDir, rel)
  const currPath = join(currDir, rel)
  if (!existsSync(currPath)) {
    lines.push(`MISSING  ${rel} (no current capture)`)
    failures++
    continue
  }
  const a = PNG.sync.read(readFileSync(basePath))
  const b = PNG.sync.read(readFileSync(currPath))
  if (a.width !== b.width || a.height !== b.height) {
    lines.push(`SIZE     ${rel} baseline ${a.width}x${a.height} vs current ${b.width}x${b.height}`)
    failures++
    continue
  }
  const diff = new PNG({ width: a.width, height: a.height })
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
  const frac = changed / (a.width * a.height)
  if (frac > THRESHOLD) {
    const outName = rel.replace(/[\\/]/g, '__')
    writeFileSync(join(diffDir, outName), PNG.sync.write(diff))
    lines.push(`DIFF     ${rel} ${(frac * 100).toFixed(3)}% pixels changed → diffs/${outName}`)
    failures++
  } else {
    lines.push(`OK       ${rel}${changed ? ` (${changed}px within tolerance)` : ''}`)
  }
}

const report = lines.join('\n')
writeFileSync(join(currDir, 'diff-report.txt'), report + '\n')
console.log(report)
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} file(s) over threshold (${THRESHOLD * 100}% pixels)`)
process.exit(failures === 0 ? 0 : 1)

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const port = process.env.PORT || '3000'

const child = spawn(process.execPath, ['--max-old-space-size=4096', nextBin, 'dev', '-p', port], {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
})

let ready = false
const warmRoutes = ['/', '/dashboard', '/dashboard/quotations', '/dashboard/artwork', '/dashboard/orders', '/dashboard/inventory', '/dashboard/invoices']

function log(chunk, isError = false) {
  const text = chunk.toString()
  process[isError ? 'stderr' : 'stdout'].write(text)

  if (!ready && /Ready in|Local:\s+http:\/\/localhost/.test(text)) {
    ready = true
    void warmUp()
  }
}

child.stdout.on('data', (chunk) => log(chunk, false))
child.stderr.on('data', (chunk) => log(chunk, true))

async function warmUp() {
  console.log('\n⚡ Warming up routes for faster first load...')
  for (const route of warmRoutes) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        headers: { Accept: 'text/html' },
      })
      console.log(`  ✓ ${route} (${response.status})`)
    } catch {
      console.log(`  · ${route} (skipped)`)
    }
  }
  console.log('⚡ Warm-up done. Open http://localhost:' + port + '\n')
}

child.on('exit', (code) => process.exit(code ?? 0))

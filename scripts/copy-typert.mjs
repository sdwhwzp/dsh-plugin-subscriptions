import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generated = resolve(root, 'packages/subscriptions/lib')
const output = resolve(root, 'lib')
mkdirSync(output, { recursive: true })
for (const file of [
  'typert.host.js',
  'typert.host.d.ts',
  'typert.remote-client.js',
  'typert.remote-client.d.ts',
  'typert.remote-client.d.ts.map',
]) {
  copyFileSync(resolve(generated, file), resolve(output, file))
}

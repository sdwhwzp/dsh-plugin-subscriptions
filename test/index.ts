/**
 * Test entry so `node --test lib-test/test/` (a directory argument resolves
 * to `lib-test/test/index.js`) picks up every compiled spec.
 */
import { after } from 'node:test'

// AbortSignal.timeout() does not keep Node alive. The old connection test host
// happened to do so; the explicit Remote test harness needs an explicit owner.
const keepAlive = setInterval(() => {}, 1_000)
after(() => { clearInterval(keepAlive) })

import './translate.spec.js'
import './chat-completions.spec.js'
import './models.spec.js'
import './catalog-store.spec.js'
import './device-flow.spec.js'
import './copilot.spec.js'
import './tools.spec.js'
import './rpc.spec.js'
import './usage.spec.js'
import './rate-limit.spec.js'
import './detect-cli.spec.js'
import './login.spec.js'
import './store.spec.js'
import './accounts.spec.js'
import './pool.spec.js'
import './pool-health.spec.js'
import './grok.spec.js'
import './model-defaults.spec.js'
import './model-defaults-rpc.spec.js'
import './model-defaults-view.spec.js'
import './image-commands.spec.js'
import './client-load.spec.js'

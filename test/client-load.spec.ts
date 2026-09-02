/** Browser Remote consumption against Cordis v4's exact nested-service injection rules. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Context, Service } from '@deepseek-ai/cordis'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { resolveSubscriptionsAuthClient } from '../src/client/subscriptions-auth-client.js'

const subscriptionsAuth = {
  execute: async () => ({ ok: true as const, value: {} }),
}

class TestRemote extends Service {
  constructor(ctx: Context) {
    super(ctx, 'remote')
  }

  async $mount(_contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
    const fiber = this.ctx.plugin({
      name: 'remote.subscriptionsAuth',
      apply: ctx => { ctx.provide('remote.subscriptionsAuth', subscriptionsAuth) },
    })
    await fiber.await()
    return async () => { await fiber.dispose() }
  }
}

test('mounted subscriptions namespace is consumed through an exact nested inject', async () => {
  const ctx = new Context()
  new TestRemote(ctx)
  const fiber = ctx.plugin({
    inject: ['remote'],
    apply: async (scope) => {
      const dispose = await scope.remote.$mount({ package: 'test', descriptors: [] })
      assert.throws(
        () => (scope.remote as unknown as { subscriptionsAuth: unknown }).subscriptionsAuth,
        /cannot get property "remote\.subscriptionsAuth" without inject/,
      )
      assert.equal(await resolveSubscriptionsAuthClient(scope), subscriptionsAuth)
      return dispose
    },
  })
  await fiber.await()
  await fiber.dispose()
})

test('package targets the Alpha.3-or-later browser platform without client-runtime', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    dsh?: { engines?: { dsh?: string }; client?: { inject?: string[] } }
    devDependencies?: Record<string, string>
  }
  const clientSource = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')

  assert.equal(manifest.dsh?.engines?.dsh, '>=0.1.2-alpha.3 <0.2.0')
  assert.ok(manifest.dsh?.client?.inject?.includes('@deepseek-ai/dsh-api-remotes'))
  assert.match(manifest.devDependencies?.['@deepseek-ai/dsh-client-store'] ?? '', /packages\/client\/store$/)
  assert.doesNotMatch(JSON.stringify(manifest), /@deepseek-ai\/dsh-client-runtime/)
  assert.match(clientSource, /@deepseek-ai\/dsh-api-remotes\/client/)
  assert.doesNotMatch(clientSource, /@deepseek-ai\/dsh-client-runtime/)
})

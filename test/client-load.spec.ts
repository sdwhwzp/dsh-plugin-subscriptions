/** Browser Remote consumption against Cordis v4's exact nested-service injection rules. */
import assert from 'node:assert/strict'
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

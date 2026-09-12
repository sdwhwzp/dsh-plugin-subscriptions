/** Browser callers use the same authenticated namespace registered by the Host. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { SUBSCRIPTIONS_AUTH_CHANNEL, SUBSCRIPTIONS_AUTH_PREFIX } from '../src/auth/rpc.js'
import { callSubscriptionsAuth, SubscriptionsAuthError } from '../src/client/subscriptions-rpc.js'

test('settings and account calls reach the authenticated Host namespace with their payload intact', async () => {
  const payload = { provider: 'codex', force: false }
  const rpc: ConnectionHandle['rpc'] = {
    async call(channel, endpoint, body) {
      assert.equal(channel, SUBSCRIPTIONS_AUTH_CHANNEL)
      assert.ok(endpoint.startsWith(SUBSCRIPTIONS_AUTH_PREFIX))
      assert.equal(body, payload)
      return { ok: true, value: { endpoint } }
    },
  }
  for (const endpoint of ['providerSettings', 'setProviderSettings', 'setModelDefault', 'status', 'usage', 'proxyGet', 'login', 'speed']) {
    assert.deepEqual(await callSubscriptionsAuth(rpc, endpoint, payload), { endpoint: `subscriptions-auth/${endpoint}` })
  }
})

test('generated media RPC preserves file references on the authenticated endpoints', async () => {
  const calls: Array<{ endpoint: string; payload: unknown }> = []
  const rpc: ConnectionHandle['rpc'] = {
    async call(channel, endpoint, payload) {
      assert.equal(channel, SUBSCRIPTIONS_AUTH_CHANNEL)
      assert.ok(endpoint.startsWith(SUBSCRIPTIONS_AUTH_PREFIX))
      calls.push({ endpoint, payload })
      return { ok: true, value: { mediaType: endpoint.endsWith('/image') ? 'image/png' : 'video/mp4', dataBase64: 'aGk=' } }
    },
  }
  const ref = { attachmentId: 'image-1', mediaType: 'image/png', bytes: 2, width: 1, height: 1 } as const
  assert.deepEqual(await callSubscriptionsAuth(rpc, 'image', ref), { mediaType: 'image/png', dataBase64: 'aGk=' })
  assert.deepEqual(await callSubscriptionsAuth(rpc, 'video', { name: 'clip.mp4' }), { mediaType: 'video/mp4', dataBase64: 'aGk=' })
  assert.deepEqual(calls, [
    { endpoint: 'subscriptions-auth/image', payload: ref },
    { endpoint: 'subscriptions-auth/video', payload: { name: 'clip.mp4' } },
  ])
})

test('business refusals and transport failures remain visible to the settings page', async () => {
  const denied: ConnectionHandle['rpc'] = { call: async () => ({ ok: false, error: { code: 'admin-forbidden', message: 'administrator required', details: {} } }) }
  await assert.rejects(callSubscriptionsAuth(denied, 'providerSettings', {}), error => error instanceof SubscriptionsAuthError && error.message === 'administrator required')
  const offline: ConnectionHandle['rpc'] = { call: async () => { throw new Error('connection offline') } }
  await assert.rejects(callSubscriptionsAuth(offline, 'providerSettings', {}), { message: 'connection offline' })
})

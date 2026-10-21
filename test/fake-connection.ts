/** Exact Fetch-route test transport with independently supplied account identity. */
import { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute, PeerScope, PeerId } from '@deepseek-ai/dsh-client-connection'
import type { AuthenticatedPrincipal } from '@deepseek-ai/dsh-llm'
import type { RpcResult } from '../src/compat.js'

/** Test-facing dispatcher models transport-authenticated identities. */
export type TestRpcHandler = (endpoint: string, payload: unknown, signal?: AbortSignal, principal?: AuthenticatedPrincipal) => Promise<RpcResult<unknown>>

/** Build one isolated exact-route registry per mounted plugin. */
export function createFakeConnection() {
  const routes = new Set<ConnectionFetchRoute>()
  const connection = {
    fetch: {
      register(route: ConnectionFetchRoute) {
        routes.add(route)
        return async () => { routes.delete(route) }
      },
    },
  }
  const handler: TestRpcHandler = async (endpoint, payload, signal, principal) => {
    const method = `subscriptions-auth.${endpoint}`
    const route = [...routes].find(value => value.path === `/api/${method}` && value.methods.includes('POST'))
    if (route === undefined) throw new Error(`no route registered for ${method}`)
    const ctx = new Context()
    const lifetime = new AbortController()
    const peer: PeerScope = {
      id: 'test-peer' as PeerId, ctx, principal: { kind: 'owner' }, signal: lifetime.signal, interactions: 'none',
      dispose: async () => { lifetime.abort(); await ctx.fiber.dispose() },
    }
    const request = new Request(`http://localhost/api/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'test-request', method, payload }),
      signal: signal ?? new AbortController().signal,
    })
    try {
      const response = await route.fetch(request, principal, peer)
      const envelope = await response.json() as { result: RpcResult<unknown> }
      return envelope.result
    } finally { await peer.dispose() }
  }
  return { connection, registered: () => routes.size > 0, handler }
}

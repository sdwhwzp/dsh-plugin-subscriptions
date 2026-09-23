/** Authenticated shared-channel test connection; the caller supplies the verified principal. */
import { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler, PeerScope, PeerId } from '@deepseek-ai/dsh-client-connection'
import type { AuthenticatedPrincipal } from '@deepseek-ai/dsh-llm'

/** Test-facing dispatcher models transport-authenticated identities. */
export type TestRpcHandler = (endpoint: string, payload: unknown, signal?: AbortSignal, principal?: AuthenticatedPrincipal) => ReturnType<ConnectionRpcHandler>

interface Interceptor {
  channel: string
  matches: (endpoint: string) => boolean
  handle: ConnectionRpcHandler
}

/** Build one isolated interceptor registry per mounted plugin. */
export function createFakeConnection() {
  const interceptors = new Set<Interceptor>()
  const identities = new WeakMap<PeerScope, AuthenticatedPrincipal>()
  const connection = {
    principalOfPeer: (peer: PeerScope) => identities.get(peer),
    rpc: {
      intercept(channel: string, matches: (endpoint: string) => boolean, handle: ConnectionRpcHandler) {
        const entry = { channel, matches, handle }
        interceptors.add(entry)
        return async () => { interceptors.delete(entry) }
      },
    },
  }
  const handler: TestRpcHandler = async (endpoint, payload, signal, principal) => {
    const method = `subscriptions-auth/${endpoint}`
    const entry = [...interceptors].find(value => value.channel === '/api' && value.matches(method))
    if (entry === undefined) throw new Error(`no interceptor registered for ${method}`)
    const ctx = new Context()
    const peer: PeerScope = { id: 'test-peer' as PeerId, ctx, dispose: () => ctx.fiber.dispose() }
    if (principal !== undefined) identities.set(peer, principal)
    try { return await entry.handle(method, payload, signal ?? new AbortController().signal, peer) }
    finally { await peer.dispose() }
  }
  return { connection, registered: () => interceptors.size > 0, handler }
}

/** Authenticated shared-channel test connection; the caller supplies the verified principal. */
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

interface Interceptor {
  channel: string
  matches: (endpoint: string) => boolean
  handle: ConnectionRpcHandler
}

/** Build one isolated interceptor registry per mounted plugin. */
export function createFakeConnection() {
  const interceptors = new Set<Interceptor>()
  const connection = {
    rpc: {
      intercept(channel: string, matches: (endpoint: string) => boolean, handle: ConnectionRpcHandler) {
        const entry = { channel, matches, handle }
        interceptors.add(entry)
        return async () => { interceptors.delete(entry) }
      },
    },
  }
  const handler: ConnectionRpcHandler = async (endpoint, payload, signal, principal) => {
    const method = `subscriptions-auth/${endpoint}`
    const entry = [...interceptors].find(value => value.channel === '/api' && value.matches(method))
    if (entry === undefined) throw new Error(`no interceptor registered for ${method}`)
    return entry.handle(method, payload, signal, principal)
  }
  return { connection, registered: () => interceptors.size > 0, handler }
}

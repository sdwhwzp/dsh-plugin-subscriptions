import type { Context } from '@deepseek-ai/cordis'
import type { AuthenticatedPrincipal } from '@deepseek-ai/dsh-llm'
import { TypertRemoteFailure, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SubscriptionJsonValue } from '../src/wire.js'

/** Test-only call surface matching the generated unary Remote client. */
export type TestRemoteHandler = (
  action: string,
  payload: unknown,
  signal: AbortSignal,
  principal?: AuthenticatedPrincipal,
) => Promise<RemoteResult<SubscriptionJsonValue>>

/**
 * Install the two host services needed to expose and authenticate the plugin Remote.
 * @param ctx - isolated test context mounted before the subscriptions plugin.
 * @returns a handler that drives the registered Remote service directly.
 */
export function prepareTestRemote(ctx: Context): TestRemoteHandler {
  let currentPrincipal: AuthenticatedPrincipal | undefined
  ctx.provide('typert', {} as Context['typert'])
  ctx.provide('typertGateway', {
    currentPrincipal: () => currentPrincipal,
  } as Context['typertGateway'])

  return async (endpoint, payload, signal, principal) => {
    currentPrincipal = principal
    const action = endpoint.slice(endpoint.lastIndexOf('/') + 1)
    try {
      const remote = ctx.get('subscriptionsAuth')
      if (remote === undefined) throw new Error('subscriptionsAuth Remote service was not registered')
      const value = await remote.execute(
        action,
        payload as SubscriptionJsonValue,
        signal,
      )
      return { ok: true, value }
    } catch (error: unknown) {
      if (error instanceof TypertRemoteFailure) return { ok: false, error: error.failure }
      throw error
    } finally {
      currentPrincipal = undefined
    }
  }
}

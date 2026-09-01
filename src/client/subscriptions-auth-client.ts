/** Cordis v4 access to the Remote namespace mounted by this browser plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type { SubscriptionsAuthClient } from './SubscriptionsSection.js'

/**
 * Resolve the mounted namespace through its exact nested service injection.
 * @param ctx - plugin context whose parent scope injected the root Remote service.
 * @returns the traced subscriptions Remote client.
 */
export async function resolveSubscriptionsAuthClient(ctx: Context): Promise<SubscriptionsAuthClient> {
  let client!: SubscriptionsAuthClient
  await ctx.inject(['remote', 'remote.subscriptionsAuth'], (scope) => {
    client = (scope.remote as unknown as { subscriptionsAuth: SubscriptionsAuthClient }).subscriptionsAuth
  }).await()
  return client
}

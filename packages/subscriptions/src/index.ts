/** Build-only public Host face used to generate the standalone Remote descriptor. */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SubscriptionJsonValue } from './wire.ts'

/** Signature mirror of the runtime service in `src/auth/rpc.ts`. */
export class SubscriptionsAuthRemote extends TypertRemoteService {
  /** @param ctx - build-only service context. */
  constructor(ctx: Context) {
    super(ctx, 'subscriptionsAuth', { namespace: 'subscriptionsAuth' })
  }

  /**
   * @param action - action name owned by the subscription plugin.
   * @param payload - lossless JSON action payload.
   * @param signal - caller cancellation.
   * @returns the action-specific lossless JSON value.
   */
  @Remote('execute')
  execute(action: string, payload: SubscriptionJsonValue, signal: AbortSignal): Promise<SubscriptionJsonValue> {
    void action
    void payload
    void signal
    throw new Error('build-only Remote signature')
  }
}

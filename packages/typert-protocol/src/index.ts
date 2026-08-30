/** Build-only type mirror that gives standalone Typert analysis package ownership. */
import { Service, type Context } from '@deepseek-ai/cordis'

/** Stable failure returned by a generated Remote call. */
export interface RemoteFailure {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

/** Result returned by the generated client proxy. */
export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** Runtime exception that carries one business failure. */
export declare class TypertRemoteFailure extends Error {
  readonly failure: RemoteFailure
  constructor(failure: RemoteFailure)
}

/** Build-only Cordis service base recognized by the Typert analyzer. */
export declare abstract class TypertRemoteService<out T = never> extends Service<T> {
  protected constructor(ctx: Context, serviceKey: string, options?: { readonly namespace?: string })
}

type RemoteMethodDecorator = <This extends object, Args extends unknown[], Result>(
  method: (this: This, ...args: Args) => Result,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
) => void

/** Build-only declaration of the runtime Remote decorator. */
export declare function Remote(option: string | { readonly mode: 'stream' }): RemoteMethodDecorator

/** JSON values accepted and returned by the subscription action dispatcher. */
export type SubscriptionJsonValue =
  | null
  | boolean
  | number
  | string
  | SubscriptionJsonValue[]
  | { [key: string]: SubscriptionJsonValue }

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** A verified subaccount attempted an administrator-only subscription operation. */
    'subscriptions/admin-forbidden': {}
  }
}

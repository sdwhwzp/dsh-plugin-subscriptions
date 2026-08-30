/** JSON values accepted and returned by the subscription action dispatcher. */
export type SubscriptionJsonValue =
  | null
  | boolean
  | number
  | string
  | SubscriptionJsonValue[]
  | { [key: string]: SubscriptionJsonValue }

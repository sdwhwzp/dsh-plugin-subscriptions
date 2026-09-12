/** Provider preferences shared by the Host store and browser editor. */
export type SubscriptionTool = 'image_generate' | 'video_generate' | 'x_search'
export interface ProviderPreferences {
  /** Absent follows discovery; an explicit selection hides newly discovered models. */
  visibleModels?: string[]
  contextWindows?: Record<string, number>
  tools?: Partial<Record<SubscriptionTool, boolean>>
}

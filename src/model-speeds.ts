/** Durable composer speed choices, separate from Settings-page subagent defaults. */
import { readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { AuthenticatedPrincipal } from '@deepseek-ai/dsh-llm'
import type { SpeedTier } from './auth/rpc.js'

/** Per-model composer preferences; publish changes only after the atomic save. */
export class ModelSpeeds {
  private current = new Map<string, SpeedTier>()
  private writes: Promise<void> = Promise.resolve()

  constructor(private readonly path = dshHomePath('plugins', 'subscriptions', 'model-speeds.json')) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('expected model-to-speed map')
      for (const [model, tier] of Object.entries(raw)) {
        if (!model.trim() || (tier !== 'standard' && tier !== 'fast')) throw new Error('invalid model speed')
        this.current.set(model, tier)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot read model speeds at ${path}`, { cause: error })
    }
  }

  get(model: string): SpeedTier | undefined {
    return this.current.get(model)
  }

  set(model: string, tier: SpeedTier): Promise<void> {
    const run = this.writes.then(async () => {
      const next = new Map(this.current).set(model, tier)
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
      try {
        await writeFile(temporary, JSON.stringify(Object.fromEntries(next), null, 2), { mode: 0o600 })
        await rename(temporary, this.path)
      } finally {
        await rm(temporary, { force: true })
      }
      this.current = next
    })
    this.writes = run.catch(() => undefined)
    return run
  }
}

export class ComposerSpeeds {
  private readonly accounts = new Map<string, {
    models: ModelSpeeds
    sessions: Map<string, SpeedTier>
    sessionModels: Map<string, Map<string, SpeedTier>>
  }>()

  private account(principal?: AuthenticatedPrincipal) {
    const key = principal === undefined ? '' : JSON.stringify([principal.source, principal.id])
    let state = this.accounts.get(key)
    if (!state) {
      const path = key === '' ? undefined : dshHomePath('plugins', 'subscriptions', 'accounts',
        createHash('sha256').update(key).digest('hex'), 'model-speeds.json')
      state = { models: new ModelSpeeds(path), sessions: new Map(), sessionModels: new Map() }
      this.accounts.set(key, state)
    }
    return state
  }

  selected(sessionId: string, model: string | undefined, principal: AuthenticatedPrincipal | undefined, subagentDefault?: SpeedTier): SpeedTier {
    const state = this.account(principal)
    return (model === undefined ? undefined : state.sessionModels.get(sessionId)?.get(model))
      ?? state.sessions.get(sessionId) ?? subagentDefault
      ?? (model === undefined ? undefined : state.models.get(model)) ?? 'standard'
  }

  async set(sessionId: string, tier: SpeedTier, model: string | undefined, principal?: AuthenticatedPrincipal) {
    const state = this.account(principal)
    if (model === undefined) {
      state.sessions.set(sessionId, tier)
      return
    }
    await state.models.set(model, tier)
    const choices = state.sessionModels.get(sessionId) ?? new Map<string, SpeedTier>()
    choices.set(model, tier)
    state.sessionModels.set(sessionId, choices)
  }
}

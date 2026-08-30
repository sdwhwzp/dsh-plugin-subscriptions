/**
 * Human-facing image slash commands backed by model-visible user messages.
 * The model remains the tool caller, so tool calls and results use the normal
 * session log and approval pipeline.
 * @module dsh-plugin-subscriptions/image-commands
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition, CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Services whose registrations control whether each image command exists. */
export interface ImageCommandOptions {
  /** Whether this plugin registered `image_generate`. */
  readonly generate: boolean
}

/** Queue one ordinary user message so its model-visible content is durable. */
function submit(invocation: CommandInvocation, text: string): void {
  invocation.agent.followup(createUserMessage({
    content: [...invocation.attachments, { type: 'text', text }],
    source: { kind: 'user' },
  }))
}

/** @internal Build the `/image` definition for focused tests. */
export function imageCommandDefinition(): CommandDefinition {
  return {
    name: 'image',
    description: 'Generate an image from a text prompt',
    input: { hint: '<prompt>', images: true },
    recordInput: false,
    handler: (invocation): CommandResult => {
      const prompt = invocation.rawInput.trim()
      if (prompt === '' && invocation.attachments.length === 0) {
        return { kind: 'error', text: 'Usage: /image <prompt> (reference images are optional).' }
      }
      const request = prompt === ''
        ? 'Use the image_generate tool to generate a new image based on the attached reference image or images.'
        : `Use the image_generate tool to generate an image from this prompt:\n${prompt}`
      submit(invocation, request)
      return { kind: 'success', text: 'Image generation request submitted.' }
    },
  }
}

/** @internal Build the `/read-image` definition for focused tests. */
export function readImageCommandDefinition(): CommandDefinition {
  return {
    name: 'read-image',
    description: 'Read and analyze a workspace image',
    input: { hint: '<image path>', images: true },
    recordInput: false,
    handler: (invocation): CommandResult => {
      const input = invocation.rawInput.trim()
      if (invocation.attachments.length > 0) {
        submit(invocation, input === '' ? 'Analyze the attached image or images.' : input)
        return { kind: 'success', text: 'Image analysis request submitted.' }
      }
      if (input === '') {
        return { kind: 'error', text: 'Usage: /read-image <workspace image path>, or attach an image.' }
      }
      submit(invocation, `Use the read_image tool to inspect this workspace image, then describe its contents:\n${input}`)
      return { kind: 'success', text: 'Image analysis request submitted.' }
    },
  }
}

/**
 * Register image commands while their backing tools are present.
 * @param ctx - context carrying `commands` and `tools`.
 * @param options - tool ownership facts from this plugin's provider setup.
 */
export function applyImageCommands(ctx: Context, options: ImageCommandOptions): void {
  if (options.generate) ctx.commands.register(imageCommandDefinition())

  let disposeRead: (() => void) | undefined
  const syncReadCommand = (): void => {
    const available = ctx.tools.get('read_image') !== undefined
    if (available && disposeRead === undefined) {
      disposeRead = ctx.commands.register(readImageCommandDefinition())
    } else if (!available && disposeRead !== undefined) {
      disposeRead()
      disposeRead = undefined
    }
  }
  ctx.effect(() => {
    syncReadCommand()
    const off = ctx.on('tools/change', syncReadCommand)
    return () => {
      off()
      disposeRead?.()
      disposeRead = undefined
    }
  }, 'dsh-plugin-subscriptions: /read-image availability')
}

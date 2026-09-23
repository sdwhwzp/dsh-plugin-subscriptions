/**
 * Resolved-image plumbing for the wire translators. ImageBlocks carry only an
 * attachment reference; the bytes live in the attachment service, which is
 * async I/O. Adapters resolve images BEFORE calling the (pure, synchronous)
 * translators, so the translators see {@link ResolvedImagePart}s with inline
 * base64 data.
 */

import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, Message, RequestMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'

/** An image block with its bytes resolved to inline base64 for the wire. */
export interface ResolvedImagePart {
  type: 'image'
  /** MIME type verified by the attachment service (e.g. `image/png`). */
  mediaType: string
  /** Base64-encoded image bytes. */
  dataBase64: string
}

/** Translator input block: a harness block, with images pre-resolved. */
export type TranslatableBlock = ContentBlock | ResolvedImagePart | ResolvedToolResultBlock

/** Tool results may themselves carry attachment-backed images. */
export interface ResolvedToolResultBlock {
  type: 'tool-result'
  toolCallId: ToolCallId
  isError?: boolean
  content: readonly TranslatableBlock[]
}

/**
 * Wires with text-only tool outputs receive images in a following user turn.
 * Defer that turn until all consecutive user messages have been processed:
 * parallel tool results can arrive in separate harness messages, and a user
 * image message must not interrupt their tool-call/output pairing.
 */
export function withToolResultImages(messages: readonly TranslatableMessage[]): TranslatableMessage[] {
  const out: TranslatableMessage[] = []
  let images: TranslatableBlock[] = []
  const flush = (): void => {
    if (images.length > 0) out.push({ role: 'user', content: images })
    images = []
  }
  for (const message of messages) {
    if (message.role === 'assistant') flush()
    out.push(message)
    for (const block of message.content) {
      if (block.type !== 'tool-result') continue
      const parts = block.content.filter((part): part is ResolvedImagePart => part.type === 'image' && 'dataBase64' in part)
      if (parts.length > 0) {
        images.push({ type: 'text', text: `Images from tool result ${String(block.toolCallId)}:` }, ...parts)
      }
    }
  }
  flush()
  return out
}

/** Translator input message: role plus resolved blocks. */
export interface TranslatableMessage {
  role: 'system' | 'user' | 'assistant'
  content: readonly TranslatableBlock[]
  /** Preserved for adapters whose provider-private replay metadata is required. */
  source?: Message['source']
}

/**
 * Resolve every ImageBlock's attachment reference to inline base64 bytes.
 * V4 tool-role messages become translator tool-result blocks; ordinary messages
 * without images pass through unchanged. A request carrying an image
 * with no attachment service available fails loudly rather than silently
 * dropping the image.
 * @param messages - the request's conversation messages.
 * @param attachments - the deployment's attachment service, when mounted.
 * @param signal - cancellation for the storage reads.
 * @returns the same messages with image blocks resolved for the translators.
 */
export async function resolveImages(
  messages: readonly (RequestMessage | TranslatableMessage)[],
  attachments: AttachmentStore | undefined,
  signal?: AbortSignal,
): Promise<readonly TranslatableMessage[]> {
  // V4 logs tool results as messages; translators share one resolved wire input.
  const normalized: readonly TranslatableMessage[] = messages.some(message => message.role === 'tool' || message.role === 'developer')
    ? messages.map(message => {
      if (message.role === 'developer') throw new LlmError('Developer messages are not supported yet', 'UNSUPPORTED_CONTENT')
      if (message.role !== 'tool') return message
      return { role: 'user', content: [{ type: 'tool-result', toolCallId: message.toolCallId,
        ...(message.isError === undefined ? {} : { isError: message.isError }), content: message.content }] }
    }) : messages as readonly TranslatableMessage[]
  const hasImage = (block: TranslatableBlock): boolean => block.type === 'image'
    || (block.type === 'tool-result' && block.content.some(hasImage))
  if (!normalized.some(message => message.content.some(hasImage))) {
    return normalized
  }
  if (attachments === undefined) {
    throw new LlmError(
      'dsh-plugin-subscriptions: the request carries an image but no attachments service is mounted; '
      + 'image input requires the harness attachment store',
      'UNSUPPORTED',
    )
  }
  const resolveBlock = async (block: TranslatableBlock): Promise<TranslatableBlock[]> => {
    if (block.type === 'tool-result') {
      return [{ ...block, content: (await Promise.all(block.content.map(resolveBlock))).flat() }]
    }
    if (block.type !== 'image' || 'dataBase64' in block) return [block]
    const stored = await attachments.readImage(block.attachment, signal)
    const { attachmentId, mediaType, bytes, width, height, name } = stored.ref
    return [{
      type: 'image',
      mediaType: stored.ref.mediaType,
      dataBase64: Buffer.from(stored.data).toString('base64'),
    }, {
      type: 'text',
      text: `Image reference (for image_generate.referenceImages): ${JSON.stringify({
        attachmentId, mediaType, bytes, width, height, ...name === undefined ? {} : { name },
      })}`,
    }]
  }
  return Promise.all(normalized.map(async (message): Promise<TranslatableMessage> => ({
    role: message.role,
    ...(message.source === undefined ? {} : { source: message.source }),
    content: (await Promise.all(message.content.map(resolveBlock))).flat(),
  })))
}

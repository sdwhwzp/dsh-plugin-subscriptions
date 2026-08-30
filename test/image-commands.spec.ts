import assert from 'node:assert/strict'
import test from 'node:test'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { imageCommandDefinition, readImageCommandDefinition } from '../src/image-commands.js'

/** Invoke one definition against a message-capturing agent. */
function invoke(
  definition: ReturnType<typeof imageCommandDefinition>,
  rawInput: string,
  attachments: CommandInvocation['attachments'] = [],
): { result: ReturnType<typeof definition.handler>; messages: UserMessage[] } {
  const messages: UserMessage[] = []
  const invocation = {
    rawInput,
    attachments,
    agent: { followup: (message: UserMessage) => { messages.push(message) } },
    signal: new AbortController().signal,
  } as unknown as CommandInvocation
  return { result: definition.handler(invocation), messages }
}

test('/image requires a prompt or reference image and submits a durable model request', () => {
  const definition = imageCommandDefinition()
  assert.deepEqual(invoke(definition, '   ').result, {
    kind: 'error',
    text: 'Usage: /image <prompt> (reference images are optional).',
  })

  const submitted = invoke(definition, '  a red panda reading  ')
  assert.deepEqual(submitted.result, { kind: 'success', text: 'Image generation request submitted.' })
  assert.deepEqual(submitted.messages[0]?.content, [{
    type: 'text',
    text: 'Use the image_generate tool to generate an image from this prompt:\na red panda reading',
  }])
})

test('/image forwards reference images before its generation instruction', () => {
  const image = {
    type: 'image' as const,
    attachment: {
      attachmentId: AttachmentId('sha256:00'),
      mediaType: 'image/png' as const,
      bytes: 1,
      width: 1,
      height: 1,
    },
  }
  const submitted = invoke(imageCommandDefinition(), '', [image])
  assert.deepEqual(submitted.messages[0]?.content[0], image)
  assert.deepEqual(submitted.messages[0]?.content[1], {
    type: 'text',
    text: 'Use the image_generate tool to generate a new image based on the attached reference image or images.',
  })
})

test('/read-image accepts a workspace path or analyzes attached images directly', () => {
  const definition = readImageCommandDefinition()
  assert.deepEqual(invoke(definition, '').result, {
    kind: 'error',
    text: 'Usage: /read-image <workspace image path>, or attach an image.',
  })

  const path = invoke(definition, ' screenshots/home.png ')
  assert.deepEqual(path.messages[0]?.content, [{
    type: 'text',
    text: 'Use the read_image tool to inspect this workspace image, then describe its contents:\nscreenshots/home.png',
  }])

  const image = {
    type: 'image' as const,
    attachment: {
      attachmentId: AttachmentId('sha256:11'),
      mediaType: 'image/jpeg' as const,
      bytes: 2,
      width: 1,
      height: 1,
    },
  }
  const attached = invoke(definition, '识别图中的文字', [image])
  assert.deepEqual(attached.messages[0]?.content[0], image)
  assert.deepEqual(attached.messages[0]?.content[1], { type: 'text', text: '识别图中的文字' })
})

import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const clientPath = path.join(here, '..', 'client.js')

let loaded
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      loaded = spec
    },
  },
}

let hookStates = []
let cursor = 0
const React = {
  createElement(type, props, ...children) {
    return {
      type,
      props: {
        ...(props ?? {}),
        children: children.length <= 1 ? children[0] : children,
      },
    }
  },
  useState(initial) {
    const index = cursor++
    if (!(index in hookStates)) hookStates[index] = initial
    return [hookStates[index], (value) => {
      hookStates[index] = typeof value === 'function' ? value(hookStates[index]) : value
    }]
  },
  useRef(initial) {
    const index = cursor++
    if (!(index in hookStates)) hookStates[index] = { current: initial }
    return hookStates[index]
  },
  useEffect() {
    cursor += 1
  },
}

await import(pathToFileURL(clientPath).href)
const client = loaded.factory((id) => {
  if (id === 'react') return React
  throw new Error(id)
})

const registrations = []
const dictionaries = {}
const ctx = {
  effect(callback) {
    const dispose = callback()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  locale: {
    register(ns, dicts) {
      dictionaries[ns] = dicts
      return () => {}
    },
    bind() {
      return (key, params) => {
        if (params === undefined) return key
        return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), key)
      }
    },
    resolveText(value) {
      return value?.zh ?? value?.en ?? String(value)
    },
  },
  slots: {
    inject(_key, callback) {
      callback()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}
client.apply(ctx)
const registration = registrations[0]
const face = registration.options.inject()

function t(key, params) {
  const template = dictionaries['why-reject-me'].zh[key] ?? key
  if (params === undefined) return template
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

function walk(node, out = []) {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  out.push(node)
  if (node.props !== undefined) walk(node.props.children, out)
  return out
}

function render(props) {
  cursor = 0
  const outer = registration.component(props)
  cursor = 0
  return outer.type(outer.props)
}

function fresh() {
  hookStates = []
}

function makeApproval(options = {}) {
  const {
    key = 'approval:test',
    sessionId = 'session-1',
    callId = 'call-1',
  } = options
  const calls = []
  return {
    calls,
    approval: {
      kind: 'approval',
      key,
      sessionId,
      callId,
      toolName: 'pwsh',
      reason: 'escalate sandbox to danger-full-access: need to write outside the workspace',
      answerable: true,
      answer: async (outcome) => {
        calls.push(['answer', outcome])
      },
    },
  }
}

function propsFor(approval, overrides = {}) {
  return {
    matched: approval,
    t,
    resolveReason: (value) => value.zh,
    sendReason: face.sendReason,
    useChat: () => null,
    ...overrides,
  }
}

function buttonsOf(tree) {
  return walk(tree).filter((node) => node.type === 'button')
}

function textareaOf(tree) {
  return walk(tree).find((node) => node.type === 'textarea')
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// 1. Empty reason: reject without any prompt.
{
  fresh()
  const { approval, calls } = makeApproval()
  let sent = 0
  const tree = render(propsFor(approval, {
    sendReason: async () => {
      sent += 1
    },
  }))
  const buttons = buttonsOf(tree)
  if (buttons.length !== 2) throw new Error(`expected 2 buttons, got ${buttons.length}`)
  buttons[0].props.onClick()
  await tick()
  if (sent !== 0) throw new Error('empty reason must not prompt')
  if (calls.length !== 1 || calls[0][1] !== 'rejected') throw new Error(`unexpected answers: ${JSON.stringify(calls)}`)
}

// 2. Filled reason: prompt first, then reject, reason trimmed.
{
  fresh()
  const { approval, calls } = makeApproval()
  const sequence = []
  const props = propsFor(approval, {
    sendReason: async (_pending, text) => {
      sequence.push(['send', text])
    },
  })
  let tree = render(props)
  const textarea = textareaOf(tree)
  if (textarea === undefined) throw new Error('missing reason textarea')
  textarea.props.onChange({ target: { value: '  请先说明为什么要改系统目录  ' } })
  tree = render(props)
  const buttons = buttonsOf(tree)
  buttons[0].props.onClick()
  await tick()
  if (sequence.length !== 1) throw new Error(`expected one send, got ${JSON.stringify(sequence)}`)
  if (sequence[0][1] !== '请先说明为什么要改系统目录') throw new Error(`reason not trimmed: ${sequence[0][1]}`)
  if (calls.length !== 1 || calls[0][1] !== 'rejected') throw new Error(`unexpected answers: ${JSON.stringify(calls)}`)
}

// 3. Allow once: no prompt, allowed-once.
{
  fresh()
  const { approval, calls } = makeApproval()
  let sent = 0
  const tree = render(propsFor(approval, {
    sendReason: async () => {
      sent += 1
    },
  }))
  buttonsOf(tree)[1].props.onClick()
  await tick()
  if (sent !== 0) throw new Error('allow must not prompt')
  if (calls.length !== 1 || calls[0][1] !== 'allowed-once') throw new Error(`unexpected answers: ${JSON.stringify(calls)}`)
}

// 4. Prompt failure keeps the panel open and shows the reason failure.
{
  fresh()
  const { approval, calls } = makeApproval()
  const props = propsFor(approval, {
    sendReason: async () => {
      throw new Error('boom')
    },
  })
  let tree = render(props)
  const textarea = textareaOf(tree)
  textarea.props.onChange({ target: { value: '因为安全' } })
  tree = render(props)
  buttonsOf(tree)[0].props.onClick()
  await tick()
  if (calls.length !== 0) throw new Error('failed reason must not reject automatically')
  // The alert is created after settle sets state; re-render to observe it.
  tree = render(props)
  const alert = walk(tree).find((node) => node.props?.role === 'alert')
  if (alert === undefined) throw new Error('missing failure alert')
  if (!String(alert.props.children).includes('boom')) throw new Error('failure text missing the cause')
}

// 5. Unsent draft survives switching away and back.
{
  fresh()
  const { approval } = makeApproval({ key: 'approval:draft', callId: 'call-draft' })
  const props = propsFor(approval, { sendReason: async () => {} })
  let tree = render(props)
  textareaOf(tree).props.onChange({ target: { value: '切换会话后还要在' } })
  tree = render(props)
  if (textareaOf(tree).props.value !== '切换会话后还要在') throw new Error('draft not held while mounted')

  fresh() // switch to another conversation: the composer unmounts
  render(propsFor(makeApproval({ key: 'approval:other', callId: 'call-other', sessionId: 'session-2' }), {
    sendReason: async () => {},
  }))
  fresh() // switch back: a fresh mount must read the held draft
  tree = render(props)
  if (textareaOf(tree).props.value !== '切换会话后还要在') throw new Error('draft was lost on Session switch')
}

// 6. Answering the approval clears the draft.
{
  fresh()
  const { approval, calls } = makeApproval({ key: 'approval:clear', callId: 'call-clear' })
  const props = propsFor(approval, { sendReason: async () => {} })
  let tree = render(props)
  textareaOf(tree).props.onChange({ target: { value: '发送后清掉' } })
  tree = render(props)
  buttonsOf(tree)[0].props.onClick()
  await tick()
  if (calls.length !== 1 || calls[0][1] !== 'rejected') throw new Error(`unexpected answers: ${JSON.stringify(calls)}`)

  fresh()
  tree = render(props)
  if (textareaOf(tree).props.value !== '') throw new Error('answered approval kept its draft')
}

console.log('panel smoke ok')

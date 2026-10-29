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

await import(pathToFileURL(clientPath).href)
if (!loaded) throw new Error('client module did not call __ModuleLoader__.load')
if (loaded.id !== 'dsh-why-reject') throw new Error(`unexpected module id: ${loaded.id}`)

const React = {
  createElement() {},
  useState() {},
  useRef() {},
  useEffect() {},
}
const client = loaded.factory((id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
})
if (!Array.isArray(client.inject)) throw new Error('missing inject array')
if (typeof client.apply !== 'function') throw new Error('missing apply')

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
      const templates = { reasonMessage: '【审批请求已拒绝】原因：{reason}' }
      return (key, params) => {
        const template = templates[key] ?? key
        if (params === undefined) return template
        return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
      }
    },
    resolveText(value) {
      return value?.zh ?? value?.en ?? String(value)
    },
  },
  slots: {
    inject(key, callback) {
      callback()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
  remote: {
    session: {
      async prompt(request) {
        ctx.remote.lastPrompt = request
        return { ok: true, value: { accepted: true } }
      },
    },
  },
}

client.apply(ctx)

if (registrations.length !== 1) throw new Error(`expected one registration, got ${registrations.length}`)
const entry = registrations[0]
if (entry.options.name !== 'conversation.composer') throw new Error('wrong slot')
if (entry.options.priority !== 0) throw new Error(`wrong priority: ${entry.options.priority}`)
if (typeof entry.options.select !== 'function') throw new Error('missing select')
if (typeof entry.options.inject !== 'function') throw new Error('missing inject')
if (typeof entry.component !== 'function') throw new Error('missing component')

const approval = { kind: 'approval', sessionId: 's1', answer() {}, key: 'approval:1' }
if (entry.options.select({ pendingInteraction: approval }) !== approval) throw new Error('select did not claim an approval')
if (entry.options.select({ pendingInteraction: approval, session: { subagent: null } }) !== approval) throw new Error('select refused a root session')
const subagentSession = { subagent: { address: { kind: 'subagent', parentSessionId: 'p1', childSessionId: 'c1', mode: 'one-shot' } } }
if (entry.options.select({ pendingInteraction: approval, session: subagentSession }) !== null) throw new Error('select claimed a subagent session')
for (const other of [undefined, null, { kind: 'question' }, { kind: 'approval' }]) {
  if (entry.options.select({ pendingInteraction: other }) !== null) throw new Error(`select claimed ${JSON.stringify(other)}`)
}

const face = entry.options.inject()
if (typeof face.resolveReason !== 'function') throw new Error('missing resolveReason')
if (typeof face.sendReason !== 'function') throw new Error('missing sendReason')
await face.sendReason(approval, '  我不需要   ')
const prompt = ctx.remote.lastPrompt
if (prompt === undefined) throw new Error('sendReason did not call session.prompt')
if (prompt.mode !== 'steer') throw new Error(`wrong mode: ${prompt.mode}`)
if (prompt.sessionId !== 's1') throw new Error('wrong session id')
if (typeof prompt.requestId !== 'string' || prompt.requestId.length === 0) throw new Error('missing request id')
if (prompt.content?.[0]?.type !== 'text') throw new Error('wrong content type')
if (!prompt.content[0].text.includes('我不需要')) throw new Error('reason missing from content')

const originalPrompt = ctx.remote.session.prompt
ctx.remote.session.prompt = async () => ({ ok: false, error: new Error('session/not-found') })
let failed = false
try {
  await face.sendReason(approval, 'again')
} catch (error) {
  failed = error.message.includes('session/not-found')
}
ctx.remote.session.prompt = originalPrompt
if (!failed) throw new Error('failure envelope was treated as success')

const zh = dictionaries['why-reject']?.zh
const en = dictionaries['why-reject']?.en
if (zh === undefined || en === undefined) throw new Error('missing dictionaries')
const zhKeys = Object.keys(zh).sort()
const enKeys = Object.keys(en).sort()
if (JSON.stringify(zhKeys) !== JSON.stringify(enKeys)) throw new Error('locale key mismatch')

console.log('smoke ok')
console.log('registered:', entry.options.name, 'priority', entry.options.priority)
console.log('prompt:', JSON.stringify(prompt, null, 2))

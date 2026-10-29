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
if (loaded.id !== 'dsh-why-reject-me') throw new Error(`unexpected module id: ${loaded.id}`)

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
if (client.inject.includes('remote')) throw new Error('client no longer needs the Session Remote')

const requests = []
globalThis.fetch = async (url, init) => {
  requests.push({ url, init })
  return { ok: true, status: 200, async json() { return { ok: true } } }
}

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
    bind(ns) {
      return (key, params) => {
        const template = dictionaries[ns]?.zh?.[key] ?? key
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
}

client.apply(ctx)

if (registrations.length !== 1) throw new Error(`expected one registration, got ${registrations.length}`)
const entry = registrations[0]
if (entry.options.name !== 'conversation.composer') throw new Error('wrong slot')
if (entry.options.priority !== 0) throw new Error(`wrong priority: ${entry.options.priority}`)
if (typeof entry.options.select !== 'function') throw new Error('missing select')
if (typeof entry.options.inject !== 'function') throw new Error('missing inject')
if (typeof entry.component !== 'function') throw new Error('missing component')

const approval = { kind: 'approval', sessionId: 's1', callId: 'c1', answer() {}, key: 'approval:1' }
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

await face.sendReason(approval, '  我不需要  ')
if (requests.length !== 1) throw new Error(`expected one POST, got ${requests.length}`)
const request = requests[0]
if (request.url !== '/api/dsh-why-reject-me/reason') throw new Error(`wrong URL: ${request.url}`)
if (request.init.method !== 'POST') throw new Error(`wrong method: ${request.init.method}`)
const body = JSON.parse(request.init.body)
if (body.sessionId !== 's1') throw new Error('wrong session id')
if (body.callId !== 'c1') throw new Error('wrong tool call id')
if (body.reason !== '我不需要') throw new Error(`reason not trimmed: ${body.reason}`)
if (body.prefix !== '【审批请求已拒绝】原因：') throw new Error(`wrong prefix: ${body.prefix}`)

const beforeEmpty = requests.length
await face.sendReason(approval, '   ')
if (requests.length !== beforeEmpty) throw new Error('empty reason must not POST')

let missingCallId = false
try {
  await face.sendReason({ sessionId: 's1' }, 'x')
} catch (error) {
  missingCallId = String(error.message).includes('Tool call')
}
if (!missingCallId) throw new Error('a missing Tool call identity must fail')

globalThis.fetch = async () => ({ ok: false, status: 500, async json() { return { error: 'boom' } } })
let failed = false
try {
  await face.sendReason(approval, 'again')
} catch (error) {
  failed = error.message.includes('boom') && error.message.includes('500')
}
if (!failed) throw new Error('a failed POST was treated as success')

const zh = dictionaries['why-reject-me']?.zh
const en = dictionaries['why-reject-me']?.en
if (zh === undefined || en === undefined) throw new Error('missing dictionaries')
const zhKeys = Object.keys(zh).sort()
const enKeys = Object.keys(en).sort()
if (JSON.stringify(zhKeys) !== JSON.stringify(enKeys)) throw new Error('locale key mismatch')

console.log('smoke ok')
console.log('registered:', entry.options.name, 'priority', entry.options.priority)
console.log('post:', request.url, JSON.stringify(body))

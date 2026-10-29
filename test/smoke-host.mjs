import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const hostPath = path.join(here, '..', 'index.js')
const host = await import(pathToFileURL(hostPath).href)

if (!Array.isArray(host.inject)) throw new Error('missing Host inject array')
if (!host.inject.includes('connection')) throw new Error('Host must inject connection')
if (!host.inject.includes('tools')) throw new Error('Host must inject tools')

let route
let listener
let listenerOptions
const ctx = {
  connection: {
    fetch: {
      register(candidate) {
        route = candidate
        return async () => {}
      },
    },
  },
  on(event, handler, options) {
    if (event !== 'tools/post-execute') throw new Error(`unexpected event: ${event}`)
    listener = handler
    listenerOptions = options
  },
}
host.apply(ctx)

if (route === undefined) throw new Error('Host did not register the reason route')
if (route.path !== '/api/dsh-why-reject-me/reason') throw new Error(`wrong route path: ${route.path}`)
if (!route.methods.includes('POST')) throw new Error('route must accept POST')
if (route.requestBody !== 'buffered') throw new Error(`wrong request body mode: ${route.requestBody}`)
if (typeof listener !== 'function') throw new Error('Host did not register tools/post-execute')
if (listenerOptions?.prepend !== true) throw new Error('post-execute listener must be prepended')

async function post(body) {
  return route.fetch(new Request(`http://127.0.0.1${route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

async function payload(response) {
  return response.json()
}

const accepted = await post({
  sessionId: 's1',
  callId: 'c1',
  reason: '  因为今天是星期五  ',
  prefix: '【审批请求已拒绝】原因：',
})
if (accepted.status !== 200) throw new Error(`unexpected status: ${accepted.status}`)
const acceptedBody = await payload(accepted)
if (acceptedBody.ok !== true || acceptedBody.stored !== true) throw new Error('reason was not stored')

const exec = { name: 'pwsh', callId: 'c1', agent: { id: 's1' } }
const rejected = {
  isError: true,
  content: [{ type: 'text', text: 'Error: the user rejected escalating this command' }],
  error: { message: 'the user rejected escalating this command' },
}
const decision = await listener(exec, rejected, async () => ({
  kind: 'accept',
  content: [{ type: 'text', text: 'downstream' }],
}))
if (decision.kind !== 'accept') throw new Error('listener changed the decision kind')
if (decision.content.length !== 2) throw new Error(`expected appended content, got ${JSON.stringify(decision.content)}`)
if (decision.content[0].text !== 'downstream') throw new Error('downstream content was replaced')
if (!decision.content[1].text.includes('因为今天是星期五')) throw new Error('reason missing from the tool result')
if (!decision.content[1].text.includes('【审批请求已拒绝】原因：')) throw new Error('reason marker missing')

// The reason is one-shot: a second result for the same call is untouched.
const again = await listener(exec, rejected, async () => ({ kind: 'accept' }))
if (again.content !== undefined) throw new Error('reason was appended twice')

// A reason for another Session does not leak across calls.
await post({ sessionId: 's2', callId: 'c2', reason: 'other' })
const otherSession = await listener(
  { name: 'pwsh', callId: 'c2', agent: { id: 's1' } },
  rejected,
  async () => ({ kind: 'accept' }),
)
if (otherSession.content !== undefined) throw new Error('reason leaked across sessions')

// Empty reasons are accepted without parking anything.
const empty = await post({ sessionId: 's3', callId: 'c3', reason: '   ' })
const emptyBody = await payload(empty)
if (empty.status !== 200 || emptyBody.stored !== false) throw new Error('empty reason should not be stored')

// Malformed requests fail closed.
const missing = await post({ sessionId: 's1', reason: 'x' })
if (missing.status !== 400) throw new Error(`missing callId should be 400, got ${missing.status}`)
const badJson = await route.fetch(new Request(`http://127.0.0.1${route.path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{',
}))
if (badJson.status !== 400) throw new Error(`invalid JSON should be 400, got ${badJson.status}`)

// Successful results never receive a reason.
await post({ sessionId: 's4', callId: 'c4', reason: 'should not appear' })
const success = await listener(
  { name: 'pwsh', callId: 'c4', agent: { id: 's4' } },
  { isError: false, content: [{ type: 'text', text: 'ok' }] },
  async () => ({ kind: 'accept' }),
)
if (success.content !== undefined) throw new Error('successful result received a reason')

console.log('host smoke ok')
console.log('route:', route.path, route.methods.join(','))
console.log('appended:', decision.content[1].text.trim())

/**
 * Host half of `dsh-why-reject-me`.
 *
 * The Client half posts the rejection reason here before answering the
 * approval. This half parks the text in memory, keyed by Session and Tool call,
 * and appends it to that call's rejected `tool/result` through the
 * `tools/post-execute` waterfall. The model therefore reads the reason as part
 * of the tool result — the same channel `ask_user_question` uses — instead of a
 * separate user message.
 */

/** Same-origin route the Client half posts one reason to. */
const REASON_PATH = '/api/dsh-why-reject-me/reason'
/** Keep in step with the Client textarea. */
const MAX_REASON_LENGTH = 2000
/** A pending reason that never met its Tool result is dropped after this. */
const REASON_TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { text: string, prefix: string, expiresAt: number }>} */
const reasons = new Map()

/** One key per Session and Tool call; both are opaque strings. */
function keyOf(sessionId, callId) {
  return `${sessionId}\u0000${callId}`
}

/** Drop expired entries so an unanswered approval cannot leak text. */
function prune(now) {
  for (const [key, value] of reasons) {
    if (value.expiresAt <= now) reasons.delete(key)
  }
}

/** One JSON response with a stable content type. */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Receive one reason from the Client.
 * @param {Request} request - buffered same-origin POST body.
 * @returns {Promise<Response>} accepted or a validation failure.
 */
async function receiveReason(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return json(400, { ok: false, error: 'invalid JSON body' })
  }
  if (body === null || typeof body !== 'object') {
    return json(400, { ok: false, error: 'invalid body' })
  }
  const { sessionId, callId, reason, prefix } = body
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return json(400, { ok: false, error: 'sessionId is required' })
  }
  if (typeof callId !== 'string' || callId.length === 0) {
    return json(400, { ok: false, error: 'callId is required' })
  }
  if (typeof reason !== 'string') {
    return json(400, { ok: false, error: 'reason is required' })
  }
  const text = reason.trim().slice(0, MAX_REASON_LENGTH)
  if (text.length === 0) {
    return json(200, { ok: true, stored: false })
  }
  const marker = typeof prefix === 'string' && prefix.length > 0
    ? prefix.slice(0, 120)
    : '[approval rejected] reason: '
  const now = Date.now()
  prune(now)
  reasons.set(keyOf(sessionId, callId), { text, prefix: marker, expiresAt: now + REASON_TTL_MS })
  return json(200, { ok: true, stored: true })
}

/**
 * Append the parked reason to the rejected Tool result.
 *
 * Registered with `prepend: true` so `next()` returns the decision every later
 * listener produced; this listener only augments an accepted failed result.
 * @param {object} exec - Tool execution carrying Session and call identity.
 * @param {object} result - final Tool result before post-processing.
 * @param {() => Promise<object>} next - downstream waterfall decision.
 * @returns {Promise<object>} the accepted decision, with reason content added.
 */
async function appendReason(exec, result, next) {
  const decision = await next()
  if (decision.kind !== 'accept' || result.isError !== true) return decision
  const sessionId = exec.agent?.id
  if (typeof sessionId !== 'string' || typeof exec.callId !== 'string') return decision
  const key = keyOf(sessionId, exec.callId)
  const stored = reasons.get(key)
  if (stored === undefined) return decision
  if (stored.expiresAt <= Date.now()) {
    reasons.delete(key)
    return decision
  }
  reasons.delete(key)
  const content = [...(decision.content ?? result.content), {
    type: 'text',
    text: `\n\n${stored.prefix}${stored.text}`,
  }]
  return { ...decision, content }
}

/** The route and the Tool pipeline are both Host-owned services. */
export const inject = ['connection', 'tools']

/**
 * Install the reason route and the Tool-result augmentation.
 * @param {object} ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.connection.fetch.register({
    path: REASON_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: receiveReason,
  })
  ctx.on('tools/post-execute', appendReason, { prepend: true })
}

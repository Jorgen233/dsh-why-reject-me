window.__ModuleLoader__.load({
  id: 'dsh-why-reject',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'why-reject'
    /** Hard cap for one rejection reason; the textarea enforces the same value. */
    const MAX_REASON_LENGTH = 2000
    /** Unique style tag id so HMR reloads can find (and update) the sheet. */
    const STYLE_ID = 'dsh-why-reject/panel.css'

    /** Simplified Chinese copy. */
    const zh = {
      waiting: '等待审批',
      sending: '正在发送原因…',
      detailAria: '审批详情',
      escalation: '工具 {toolName} 请求越权执行',
      reject: '拒绝',
      allowOnce: '允许一次',
      reasonLabel: '拒绝原因（可选）',
      reasonPlaceholder: '写下拒绝的理由，会随「拒绝」一起发给模型；留空则只发送拒绝。',
      reasonHint: 'Ctrl/⌘ + Enter 拒绝并发送原因',
      sendFailed: '原因发送失败：{message}',
      rejectFailed: '拒绝没有送达：{message}',
      rejecting: '正在拒绝…',
      allowing: '正在允许…',
      reasonMessage: '【审批请求已拒绝】原因：{reason}',
    }

    /** English copy, checked against the Chinese key set. */
    const en = {
      waiting: 'Waiting for approval',
      sending: 'Sending rejection reason…',
      detailAria: 'Approval details',
      escalation: 'Tool {toolName} requests privileged execution',
      reject: 'Reject',
      allowOnce: 'Allow once',
      reasonLabel: 'Rejection reason (optional)',
      reasonPlaceholder: 'Explain why you reject this request. It is sent to the model with the rejection; leave empty to reject without a reason.',
      reasonHint: 'Ctrl/⌘ + Enter rejects and sends the reason',
      sendFailed: 'Could not send the reason: {message}',
      rejectFailed: 'The rejection was not delivered: {message}',
      rejecting: 'Rejecting…',
      allowing: 'Allowing…',
      reasonMessage: '[Approval request rejected] Reason: {reason}',
    }

    /**
     * Panel stylesheet, adapted from the shipped approval panel and primitives
     * Button so the takeover looks like the host surface. Class names are
     * prefixed with `dwr_` to avoid colliding with any shipped stylesheet.
     */
    const css = {
      root: 'dwr_root',
      card: 'dwr_card',
      strip: 'dwr_strip',
      dot: 'dwr_dot',
      body: 'dwr_body',
      headline: 'dwr_headline',
      command: 'dwr_command',
      reasonLabel: 'dwr_reasonLabel',
      reason: 'dwr_reason',
      hint: 'dwr_hint',
      error: 'dwr_error',
      actionRow: 'dwr_actionRow',
      button: 'dwr_btn',
      medium: 'dwr_md',
      outline: 'dwr_outline',
      primary: 'dwr_primary',
      reject: 'dwr_reject',
    }

    const STYLE_TEXT = `
.dwr_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}
.dwr_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);overflow:hidden}
.dwr_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}
.dwr_dot{width:8px;height:8px;border-radius:999px;corner-shape:round;background:currentColor;flex:none}
.dwr_dot[data-state=sending]{animation:dwr_pulse 1s ease-in-out infinite}
@keyframes dwr_pulse{0%,100%{opacity:.35}50%{opacity:1}}
.dwr_body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}
.dwr_headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px}
.dwr_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}
.dwr_reasonLabel{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dwr_reason{box-sizing:border-box;width:100%;min-height:56px;max-height:160px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:19px;resize:vertical}
.dwr_reason::placeholder{color:var(--dsw-alias-label-secondary)}
.dwr_reason:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dwr_reason:disabled{opacity:.6;cursor:not-allowed}
.dwr_hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dwr_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;word-break:break-word}
.dwr_actionRow{justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}
.dwr_btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px}
.dwr_btn:disabled{cursor:not-allowed;opacity:.4}
.dwr_md{height:36px}
.dwr_outline{border:.5px solid var(--dsw-alias-border-l3);background:transparent}
.dwr_outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dwr_reject:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:transparent}
.dwr_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.dwr_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
`

    /** Install (or refresh) the plugin stylesheet exactly once per page. */
    function installStyle(ctx) {
      if (typeof document === 'undefined') return
      const selector = 'style[data-plugin-css=' + JSON.stringify(STYLE_ID) + ']'
      const existing = document.querySelector(selector)
      if (existing !== null) {
        existing.textContent = STYLE_TEXT
        return
      }
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-why-reject'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = STYLE_TEXT
      ctx.effect(() => {
        if (!tag.isConnected) document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'dsh-why-reject: panel stylesheet')
    }

    /** Resolve one failure into a short, localizable message. */
    function messageOf(cause) {
      if (cause instanceof Error && cause.message.length > 0) return cause.message
      const text = String(cause)
      return text.length > 0 ? text : 'unknown error'
    }

    /** Mint a prompt request id; the browser UUID is available in the Web GUI. */
    function newRequestId() {
      try {
        if (globalThis.crypto !== undefined && typeof globalThis.crypto.randomUUID === 'function') {
          return globalThis.crypto.randomUUID()
        }
      } catch {
        // fall through to the deterministic-enough fallback
      }
      return 'why-reject-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    }

    /** Sample the browser time zone; an invalid one would be rejected by the Host. */
    function clientTimeZone() {
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
        return typeof zone === 'string' && zone.length > 0 ? zone : undefined
      } catch {
        return undefined
      }
    }

    /**
     * Send one rejection reason into the pending approval's Session.
     *
     * `mode: "steer"` enters the next-step inbox, so the model sees the reason
     * immediately after the rejection tool result (or at the start of the next
     * turn when the rejection ends this turn first).
     */
    async function sendReason(ctx, pending, text) {
      const remote = ctx.remote
      if (remote === undefined || remote.session === undefined || typeof remote.session.prompt !== 'function') {
        throw new Error('session.prompt is unavailable in this composition')
      }
      const reasonText = String(text ?? '').trim().slice(0, MAX_REASON_LENGTH)
      if (reasonText.length === 0) return
      const sessionId = pending !== null && typeof pending === 'object' ? pending.sessionId : undefined
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Error('the pending approval has no Session identity')
      }
      const t = ctx.locale.bind(NS)
      const request = {
        requestId: newRequestId(),
        sessionId,
        mode: 'steer',
        content: [{ type: 'text', text: t('reasonMessage', { reason: reasonText }) }],
      }
      const zone = clientTimeZone()
      if (zone !== undefined) request.clientTimeZone = zone
      const result = await remote.session.prompt(request)
      // Generated Remote methods answer with a `RemoteResult` envelope; a
      // business failure is `{ ok: false, error }`, not a thrown value.
      if (result !== null && typeof result === 'object' && typeof result.ok === 'boolean') {
        if (!result.ok) {
          throw result.error instanceof Error ? result.error : new Error('the Session did not accept the reason')
        }
        return
      }
      if (result !== null && typeof result === 'object' && result.accepted === false) {
        throw new Error('the Session did not accept the reason')
      }
    }

    /** Whether one Session pending interaction is the approval takeover we own. */
    function isApproval(value) {
      return value !== null
        && typeof value === 'object'
        && value.kind === 'approval'
        && typeof value.answer === 'function'
        && typeof value.sessionId === 'string'
    }

    /**
     * Whether the addressed Session is a subagent conversation.
     *
     * Subagent sessions keep the shipped approval behavior: the Host disables
     * approval prompts there and auto-rejects escalation, so this plugin must
     * not claim their pending interactions (and never asks for a reason).
     * @param session - current Session snapshot from the composer owner props.
     */
    function isSubagentSession(session) {
      return session !== undefined && session !== null && session.subagent != null
    }

    /**
     * Render the command text of the Tool call correlated with an approval.
     * Mirrors the shipped `ApprovalCommand`, using the standard `useChat` prop
     * instead of the shipped detail slot so this entry declares no children.
     */
    function CommandDetail(props) {
      const command = props.useChat((snapshot) => {
        for (const node of snapshot.nodes.values()) {
          const root = node.kind === 'tool-call' ? node.data.root : undefined
          if (root !== undefined && root.callId === props.callId && !('kind' in root) && root.phase === 'start') {
            try {
              const args = JSON.parse(root.argsRaw)
              return typeof args.command === 'string' ? args.command : null
            } catch {
              return null
            }
          }
        }
        return null
      })
      return command === null || command === undefined
        ? null
        : h('div', { className: css.command }, command)
    }

    /**
     * One pending approval with an optional rejection reason.
     *
     * Remounted per `pending.key` by {@link WhyRejectPanel}, so a new approval
     * never inherits the previous draft or error.
     */
    function ApprovalReasonPanel(props) {
      const pending = props.matched
      const t = props.t
      const [reason, setReason] = React.useState('')
      const [phase, setPhase] = React.useState(null)
      const [error, setError] = React.useState(null)
      const waiting = React.useRef(false)
      const active = React.useRef(true)
      const sentReason = React.useRef(null)
      const busy = phase !== null

      React.useEffect(() => {
        active.current = true
        return () => {
          active.current = false
        }
      }, [])

      const settle = async (outcome) => {
        if (waiting.current || pending.answerable === false) return
        waiting.current = true
        const text = reason.trim().slice(0, MAX_REASON_LENGTH)
        const sendsReason = outcome === 'rejected' && text.length > 0 && sentReason.current !== text
        setPhase(outcome === 'allowed-once' ? 'allowing' : sendsReason ? 'sending' : 'rejecting')
        setError(null)
        let stage = 'reason'
        try {
          if (sendsReason) {
            await props.sendReason(pending, text)
            sentReason.current = text
            if (active.current) setPhase('rejecting')
          }
          stage = 'answer'
          await pending.answer(outcome)
        } catch (cause) {
          if (!active.current) return
          waiting.current = false
          setPhase(null)
          setError(t(stage === 'reason' ? 'sendFailed' : 'rejectFailed', { message: messageOf(cause) }))
        }
      }

      const keydown = (event) => {
        if (event.defaultPrevented || waiting.current) return
        const element = event.target
        const field = element !== null && element.closest !== undefined
          ? element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
          : null
        const composing = (event.nativeEvent !== undefined && event.nativeEvent.isComposing === true) || event.keyCode === 229
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          if (composing) return
          event.preventDefault()
          event.stopPropagation()
          settle('rejected')
          return
        }
        if (event.key === 'Escape') {
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
          if (field !== null && reason.trim().length > 0) {
            event.preventDefault()
            field.blur()
            return
          }
          event.preventDefault()
          event.stopPropagation()
          settle('rejected')
          return
        }
        if (event.key !== 'Enter') return
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || composing) return
        if (element !== null && element.closest !== undefined && element.closest('button, a[href], [role="button"]') !== null) return
        if (field !== null) return
        event.preventDefault()
        event.stopPropagation()
        settle('allowed-once')
      }

      const headline = pending.displayReason === undefined
        ? (pending.reason === undefined ? t('escalation', { toolName: pending.toolName }) : pending.reason)
        : props.resolveReason(pending.displayReason)
      const detail = pending.callId !== undefined && typeof props.useChat === 'function'
        ? h(CommandDetail, { useChat: props.useChat, callId: pending.callId })
        : null
      const disabled = busy || pending.answerable === false
      const stripText = phase === 'sending'
        ? t('sending')
        : phase === 'allowing'
          ? t('allowing')
          : phase === 'rejecting'
            ? t('rejecting')
            : t('waiting')

      return h('div', {
        className: css.root,
        'data-approval-key': pending.key,
        'data-why-reject': 'approval',
        'aria-busy': busy,
        onKeyDown: keydown,
      }, h('div', { className: css.card }, [
        h('div', { className: css.strip }, [
          h('span', { className: css.dot, 'data-state': phase === 'sending' ? 'sending' : 'waiting', 'aria-hidden': true }),
          stripText,
        ]),
        h('div', {
          className: css.body,
          'data-approval-scroll': '',
          tabIndex: 0,
          role: 'group',
          'aria-label': t('detailAria'),
        }, [
          h('div', { className: css.headline }, headline),
          detail,
          h('div', { className: css.reasonLabel }, t('reasonLabel')),
          h('textarea', {
            className: css.reason,
            value: reason,
            rows: 2,
            maxLength: MAX_REASON_LENGTH,
            placeholder: t('reasonPlaceholder'),
            'aria-label': t('reasonLabel'),
            disabled,
            onChange: (event) => {
              setReason(event.target.value)
              if (error !== null) setError(null)
            },
          }),
          h('div', { className: css.hint }, t('reasonHint')),
          error === null ? null : h('div', { className: css.error, role: 'alert' }, error),
        ]),
        h('div', { className: css.actionRow }, [
          h('button', {
            type: 'button',
            className: css.button + ' ' + css.medium + ' ' + css.outline + ' ' + css.reject,
            disabled,
            onClick: () => {
              settle('rejected')
            },
          }, t('reject')),
          h('button', {
            type: 'button',
            className: css.button + ' ' + css.medium + ' ' + css.primary,
            disabled,
            onClick: () => {
              settle('allowed-once')
            },
          }, t('allowOnce')),
        ]),
      ]))
    }

    /** Remount the panel whenever the pending approval changes. */
    function WhyRejectPanel(props) {
      const approval = props.matched
      return h(ApprovalReasonPanel, { ...props, key: approval.key })
    }

    /** Required Client services: slot registry, copy, and the generated Session Remote. */
    const inject = ['slots', 'locale', 'remote', 'remote.session']

    /**
     * Install the approval takeover.
     * @param ctx - Client root context.
     */
    function apply(ctx) {
      installStyle(ctx)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-why-reject: dictionaries')
      ctx.slots.inject('conversation.composer', () => ctx.slots.register({
        name: 'conversation.composer',
        // Lower number wins in a chain: the shipped approval takeover is 1,
        // and the ordinary composer entries decline while an approval is pending.
        // Subagent conversations are explicitly left to the shipped behavior.
        priority: 0,
        select: ({ pendingInteraction, session }) => {
          if (isSubagentSession(session)) return null
          return isApproval(pendingInteraction) ? pendingInteraction : null
        },
        locale: NS,
        inject: () => ({
          resolveReason: (reason) => ctx.locale.resolveText(reason),
          sendReason: (pending, text) => sendReason(ctx, pending, text),
        }),
      }, WhyRejectPanel))
    }

    return { inject, apply }
  },
})

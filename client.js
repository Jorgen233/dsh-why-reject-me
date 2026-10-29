window.__ModuleLoader__.load({
  id: 'dsh-why-reject-me',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'why-reject-me'
    /** Hard cap for one rejection reason; the textarea enforces the same value. */
    const MAX_REASON_LENGTH = 2000
    /** Keep an unsent draft while the user switches Sessions and comes back. */
    const DRAFT_TTL_MS = 30 * 60 * 1000
    /** Unique style tag id so HMR reloads can find (and update) the sheet. */
    const STYLE_ID = 'dsh-why-reject-me/panel.css'

    /** @type {Map<string, { text: string, expiresAt: number }>} */
    const drafts = new Map()

    /** One draft identity: Session + Tool call, with the pending key as fallback. */
    function draftKey(pending) {
      if (pending === null || typeof pending !== 'object') return undefined
      const sessionId = typeof pending.sessionId === 'string' && pending.sessionId.length > 0
        ? pending.sessionId
        : undefined
      if (sessionId === undefined) return undefined
      if (typeof pending.callId === 'string' && pending.callId.length > 0) {
        return `${sessionId}\u0000${pending.callId}`
      }
      if (typeof pending.key === 'string' && pending.key.length > 0) {
        return `${sessionId}\u0000${pending.key}`
      }
      return undefined
    }

    /** Read one draft, dropping it once its approval is long gone. */
    function readDraft(key) {
      if (key === undefined) return ''
      const entry = drafts.get(key)
      if (entry === undefined) return ''
      if (entry.expiresAt <= Date.now()) {
        drafts.delete(key)
        return ''
      }
      return entry.text
    }

    /** Store one draft; an emptied field removes the entry. */
    function writeDraft(key, text) {
      if (key === undefined) return
      if (text.length === 0) {
        drafts.delete(key)
        return
      }
      const now = Date.now()
      for (const [keyOfEntry, entry] of drafts) {
        if (entry.expiresAt <= now) drafts.delete(keyOfEntry)
      }
      drafts.set(key, { text, expiresAt: now + DRAFT_TTL_MS })
    }

    /** Drop one draft once its approval is answered. */
    function clearDraft(key) {
      if (key !== undefined) drafts.delete(key)
    }

    /** Simplified Chinese copy. */
    const zh = {
      waiting: '等待审批',
      sending: '正在提交原因…',
      detailAria: '审批详情',
      escalation: '工具 {toolName} 请求越权执行',
      reject: '拒绝',
      allowOnce: '允许一次',
      reasonLabel: '拒绝原因（可选）',
      reasonPrefix: '【审批请求已拒绝】原因：',
      reasonPlaceholder: '写下拒绝的理由，会附在拒绝结果里交给模型；留空则只发送拒绝。',
      reasonHint: 'Ctrl/⌘ + Enter 拒绝并附上原因',
      sendFailed: '原因提交失败：{message}',
      rejectFailed: '拒绝没有送达：{message}',
      rejecting: '正在拒绝…',
      allowing: '正在允许…',
    }

    /** English copy, checked against the Chinese key set. */
    const en = {
      waiting: 'Waiting for approval',
      sending: 'Submitting rejection reason…',
      detailAria: 'Approval details',
      escalation: 'Tool {toolName} requests privileged execution',
      reject: 'Reject',
      allowOnce: 'Allow once',
      reasonLabel: 'Rejection reason (optional)',
      reasonPrefix: '[Approval request rejected] Reason: ',
      reasonPlaceholder: 'Explain why you reject this request. It is attached to the rejection result for the model; leave empty to reject without a reason.',
      reasonHint: 'Ctrl/⌘ + Enter rejects and attaches the reason',
      sendFailed: 'Could not submit the reason: {message}',
      rejectFailed: 'The rejection was not delivered: {message}',
      rejecting: 'Rejecting…',
      allowing: 'Allowing…',
    }

    /**
     * Panel stylesheet, adapted from the shipped approval panel and primitives
     * Button so the takeover looks like the host surface. Class names are
     * prefixed with `dwrm_` to avoid colliding with any shipped stylesheet.
     */
    const css = {
      root: 'dwrm_root',
      card: 'dwrm_card',
      strip: 'dwrm_strip',
      dot: 'dwrm_dot',
      body: 'dwrm_body',
      headline: 'dwrm_headline',
      command: 'dwrm_command',
      reasonLabel: 'dwrm_reasonLabel',
      reason: 'dwrm_reason',
      hint: 'dwrm_hint',
      error: 'dwrm_error',
      actionRow: 'dwrm_actionRow',
      button: 'dwrm_btn',
      medium: 'dwrm_md',
      outline: 'dwrm_outline',
      primary: 'dwrm_primary',
      reject: 'dwrm_reject',
    }

    const STYLE_TEXT = `
.dwrm_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}
.dwrm_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);overflow:hidden}
.dwrm_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}
.dwrm_dot{width:8px;height:8px;border-radius:999px;corner-shape:round;background:currentColor;flex:none}
.dwrm_dot[data-state=sending]{animation:dwrm_pulse 1s ease-in-out infinite}
@keyframes dwrm_pulse{0%,100%{opacity:.35}50%{opacity:1}}
.dwrm_body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}
.dwrm_headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px}
.dwrm_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}
.dwrm_reasonLabel{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dwrm_reason{box-sizing:border-box;width:100%;min-height:56px;max-height:160px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:19px;resize:vertical}
.dwrm_reason::placeholder{color:var(--dsw-alias-label-secondary)}
.dwrm_reason:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dwrm_reason:disabled{opacity:.6;cursor:not-allowed}
.dwrm_hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dwrm_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;word-break:break-word}
.dwrm_actionRow{justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}
.dwrm_btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px}
.dwrm_btn:disabled{cursor:not-allowed;opacity:.4}
.dwrm_md{height:36px}
.dwrm_outline{border:.5px solid var(--dsw-alias-border-l3);background:transparent}
.dwrm_outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dwrm_reject:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:transparent}
.dwrm_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.dwrm_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
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
      tag.dataset.plugin = 'dsh-why-reject-me'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = STYLE_TEXT
      ctx.effect(() => {
        if (!tag.isConnected) document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'dsh-why-reject-me: panel stylesheet')
    }

    /** Resolve one failure into a short, localizable message. */
    function messageOf(cause) {
      if (cause instanceof Error && cause.message.length > 0) return cause.message
      const text = String(cause)
      return text.length > 0 ? text : 'unknown error'
    }

    /**
     * Hand one rejection reason to the Host half.
     *
     * The Host parks it in memory and appends it to the rejected Tool call's
     * `tool/result`; the model reads it there, exactly like an
     * `ask_user_question` answer. No user message is created.
     */
    async function sendReason(pending, text, prefix) {
      const reason = String(text ?? '').trim().slice(0, MAX_REASON_LENGTH)
      if (reason.length === 0) return
      const sessionId = pending !== null && typeof pending === 'object' ? pending.sessionId : undefined
      const callId = pending !== null && typeof pending === 'object' ? pending.callId : undefined
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Error('the pending approval has no Session identity')
      }
      if (typeof callId !== 'string' || callId.length === 0) {
        throw new Error('the pending approval has no Tool call identity')
      }
      const marker = typeof prefix === 'string' ? prefix.slice(0, 120) : undefined
      const response = await fetch('/api/dsh-why-reject-me/reason', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          callId,
          reason,
          ...(marker === undefined ? {} : { prefix: marker }),
        }),
      })
      if (response.ok) return
      let detail = ''
      try {
        const payload = await response.json()
        if (payload !== null && typeof payload === 'object' && typeof payload.error === 'string') {
          detail = payload.error
        }
      } catch {
        // keep the status-only message
      }
      throw new Error(detail.length > 0 ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`)
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
      const draftId = draftKey(pending)
      const [reason, setReason] = React.useState(readDraft(draftId))
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

      React.useEffect(() => {
        setReason(readDraft(draftId))
      }, [draftId])

      React.useEffect(() => {
        if (pending.answerable === false) clearDraft(draftId)
      }, [pending.answerable, draftId])

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
          clearDraft(draftId)
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
        'data-why-reject-me': 'approval',
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
              const next = event.target.value
              setReason(next)
              writeDraft(draftId, next)
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

    /** Required Client services: slot registry and copy. */
    const inject = ['slots', 'locale']

    /**
     * Install the approval takeover.
     * @param ctx - Client root context.
     */
    function apply(ctx) {
      installStyle(ctx)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-why-reject-me: dictionaries')
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
          sendReason: (pending, text) => sendReason(pending, text, ctx.locale.bind(NS)('reasonPrefix')),
        }),
      }, WhyRejectPanel))
    }

    return { inject, apply }
  },
})

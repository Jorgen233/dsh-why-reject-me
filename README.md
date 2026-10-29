# dsh-why-reject

给 DSH 的权限审批弹窗加一个可选的「拒绝原因」。拒绝时原因会作为一条用户消息发给模型；留空则完全保持原生行为。

> 状态：已在 DSH Desktop 的 desktop profile 安装，并完成真实提权审批的端到端验证
> （有原因会送达模型；留空拒绝不产生额外消息）。

## 它做了什么

- 接管 `conversation.composer` 上的审批面板（仅当 pending 交互是审批、且当前不是子代理会话时）；
- 在「拒绝 / 允许一次」上方增加原因输入框；
- 点「拒绝」时：
  1. 如果原因非空，通过公开的 `ctx.remote.session.prompt({ mode: "steer" })` 把
     `【审批请求已拒绝】原因：…` 写进当前会话的 next-step 收件箱；
  2. 再调用原审批对象的 `answer("rejected")`；
- 原因留空时不发消息，行为与原生一致；
- 子代理会话不接管：运行时会在子代理上下文里自动拒绝提权，插件显式放弃这些审批，
  保持原生行为；
- 不修改任何 DSH 自带包。

## 快捷键

| 按键 | 行为 |
| --- | --- |
| `Enter`（焦点不在输入框） | 允许一次 |
| `Ctrl/⌘ + Enter` | 拒绝并发送原因 |
| `Esc`（输入框有内容） | 失焦，不误触拒绝 |
| `Esc`（输入框为空） | 普通拒绝 |

## 安装

```text
plugin_manager action=install_bundle target=<workspace>\dsh-why-reject
```

安装后刷新 Web GUI。插件会影响当前 profile 的所有会话。

## 卸载 / 回滚

```text
plugin_manager action=set_bundle target=dsh-why-reject enabled=false
# 或
plugin_manager action=remove_bundle target=dsh-why-reject
```

卸载后审批面板恢复为自带样式。

## 已知限制

- 原因以用户消息出现，会进入会话记录，也会被模型当作后续输入；
- **子代理会话不适用**：子代理上下文的审批提示被运行时禁用，提权会被自动拒绝；
  插件不会接管这类会话，因此没有原因输入框，拒绝文案仍是运行时的原文
  （`the user rejected ...`，与人工拒绝同文）。这是 DSH 核心策略，不是本插件能改的；
- 原因上限 2000 字；
- 依赖以下公开面：`conversation.composer` 链式插槽、`PendingApproval.kind/answer`、
  `ctx.remote.session.prompt`、`SessionSnapshot.subagent`。DSH 大版本升级后若这些公开面变化，需要同步适配。

## 开发检查

```bash
npm test
# 等价于
node test/smoke-client.mjs && node test/smoke-panel.mjs
```

两个冒烟测试不依赖 DSH 运行时：它们用模拟的模块加载器、React 与 Slot 上下文检查
插槽注册、原因发送顺序、空原因/允许/失败分支。真实 GUI 验证仍需安装后手测。


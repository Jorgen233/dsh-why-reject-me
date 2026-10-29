# dsh-why-reject-me

给 DSH 的权限审批弹窗加一个可选的「拒绝原因」。拒绝时原因会附在被拒绝工具的 tool result 里交给模型；留空则完全保持原生行为。

> 状态：v0.3.0，改为 `ask_user_question` 同级的 tool result 注入；已完成真实审批验证
> （原因进入 tool result，不产生用户消息；留空保持原生拒绝）。

## 它做了什么

- 接管 `conversation.composer` 上的审批面板（仅当 pending 交互是审批、且当前不是子代理会话时）；
- 在「拒绝 / 允许一次」上方增加原因输入框；
- 点「拒绝」时：
  1. 如果原因非空，客户端把 `{ sessionId, callId, reason, prefix }` POST 给 Host 的
     `/api/dsh-why-reject-me/reason`；
  2. Host 在内存里按 Session + Tool call 暂存原因；
  3. 客户端再调用原审批对象的 `answer("rejected")`；
  4. 拒绝结果产生后，Host 的 `tools/post-execute` 监听器把
     `【审批请求已拒绝】原因：…` 追加到这条 tool result 的 content；
- 原因不会成为一条 `user/message`，也不会单独起一轮；模型在同一个 tool result 里读到它，
  与 `ask_user_question` 的答案同级；
- 未发送的原因草稿会按 Session + Tool call 保留 30 分钟：切到其他对话再回来不会丢字；
  审批被回答后清除；
- 原因留空时不发请求，行为与原生一致；
- 子代理会话不接管：运行时会在子代理上下文里自动拒绝提权，插件显式放弃这些审批，
  保持原生行为；
- 不修改任何 DSH 自带包。

## 快捷键

| 按键 | 行为 |
| --- | --- |
| `Enter`（焦点不在输入框） | 允许一次 |
| `Ctrl/⌘ + Enter` | 拒绝并附上原因 |
| `Esc`（输入框有内容） | 失焦，不误触拒绝 |
| `Esc`（输入框为空） | 普通拒绝 |

## 安装

```text
plugin_manager action=install_bundle target=<workspace>\dsh-why-reject-me
```

安装或更新 Host 半后重启 DSH Desktop；仅改客户端时刷新 Web GUI 即可。插件会影响当前 profile 的所有会话。

## 卸载 / 回滚

```text
plugin_manager action=set_bundle target=dsh-why-reject-me enabled=false
# 或
plugin_manager action=remove_bundle target=dsh-why-reject-me
```

卸载后审批面板恢复为自带样式。

## 已知限制

- 原因作为 tool result 的一部分出现，不是用户消息，也不会另起一轮；它仍会进入会话记录
  （`tool/result`），与 `ask_user_question` 的答案同级——这是“模型可见”的必要代价；
- 展开被拒绝工具的结果卡片时，可能看到这段原因；
- **子代理会话不适用**：子代理上下文的审批提示被运行时禁用，提权会被自动拒绝；
  插件不会接管这类会话，因此没有原因输入框，拒绝文案仍是运行时的原文
  （`the user rejected ...`，与人工拒绝同文）。这是 DSH 核心策略，不是本插件能改的；
- 原因上限 2000 字；Host 暂存 5 分钟未匹配到拒绝结果就丢弃；
- 草稿只存在当前页面内存里：切会话不丢，但刷新页面会丢；
- 依赖以下公开面：`conversation.composer` 链式插槽、`PendingApproval.kind/answer/callId`、
  `ctx.connection.fetch.register`、`tools/post-execute`、`SessionSnapshot.subagent`。
  DSH 大版本升级后若这些公开面变化，需要同步适配。

## 开发检查

```bash
npm test
# 等价于
node test/smoke-client.mjs && node test/smoke-panel.mjs && node test/smoke-host.mjs
```

三个冒烟测试不依赖 DSH 运行时：客户端测试用模拟的模块加载器、React 与 Slot 上下文检查
插槽注册、POST 形状、空原因/允许/失败分支；Host 测试用模拟的 `connection.fetch` 与
`tools/post-execute` 检查原因暂存、一次性追加、跨 Session 隔离与非法请求。
真实 GUI 验证仍需安装并重启后手测。


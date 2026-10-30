# dsh-why-reject-me

简体中文 | [English](README_en.md)

给 DSH 的权限审批弹窗加一个可选的「拒绝原因」。拒绝时，原因会附在被拒绝工具的 **tool result** 里交给模型；留空则完全保持原生行为。

> 本项目的代码、测试与文档完全由 DeepSeek 搭建和维护。

状态：`v0.3.2`，已在 DSH Desktop `0.2.1-rc.5` 上完成真实审批验证，并验证了让 Agent 从 GitHub 直接安装。

## 目录

- [它解决什么问题](#它解决什么问题)
- [效果](#效果)
- [安装](#安装)
- [使用](#使用)
- [快捷键](#快捷键)
- [工作原理](#工作原理)
- [兼容性](#兼容性)
- [已知限制](#已知限制)
- [卸载与回滚](#卸载与回滚)
- [故障排查](#故障排查)
- [开发与测试](#开发与测试)
- [许可证](#许可证)
- [关于本项目](#关于本项目)

## 它解决什么问题

DSH 原生审批只有「允许一次 / 拒绝」两个动作。模型只知道请求被拒绝了，不知道为什么：是路径不对、命令太危险，还是这次只是在做测试。

常见的场景：

- 不想给某个操作权限，但希望模型换一种做法；
- 在测试权限流程，需要明确告诉模型「这次拒绝是故意的」；
- 先让模型解释计划、给出 diff，再决定是否放行；
- 拒绝原因本身是下一步的输入，而不是一句无关的备注。

这个插件在审批面板上加一个可选输入框，把原因送到模型能读到的地方，同时不新增用户消息、不额外起一轮对话。

## 效果

输入原因后点「拒绝」，模型收到的 tool result 末尾会多出一段：

```text
【审批请求已拒绝】原因：先不要动系统目录，把 diff 发给我看。
```

| 操作 | 结果 |
| --- | --- |
| 输入原因 → 拒绝 | 原因附在该工具的 tool result 里，模型在同一轮读到 |
| 不输入 → 拒绝 | 与原生拒绝完全一致，不发送任何额外内容 |
| 允许一次 | 与原生一致，输入框内容不会被发送 |

前缀随界面语言变化：中文为 `【审批请求已拒绝】原因：`，英文为 `[Approval request rejected] Reason: `。

## 安装

从 GitHub 安装，或克隆到本地开发和调试。

### 前置条件

- **DSH Desktop**。插件在 DSH Desktop 内嵌的审批界面中运行，本项目也只在 Desktop 中验证；`dsh-TUI` 不使用这个面板。
- 在 DSH Desktop `0.2.1-rc.5` 上验证通过；其他版本见[兼容性](#兼容性)。
- 从 GitHub 安装需要本机有 **Git**，并且能访问 GitHub。
- 安装会修改当前 profile，**影响该 profile 下的所有会话**。
- 插件以 Host 插件身份在 DSH 进程内运行；请只从本仓库或你信任的副本安装。

### 方式一：从 GitHub 安装（推荐）

**在 DSH Desktop 中：**

1. 打开 DSH Desktop，进入左侧 **Plugins（插件）** 页面。
2. 点 **Add plugin（添加插件）** → **Install a third-party plugin（安装第三方插件）**。
3. 填入仓库地址：

   ```text
   git+https://github.com/Jorgen233/dsh-why-reject-me.git
   ```

4. 点 **Install（安装）**。
5. 安装完成后如果出现 **Enable now（立即启用）**，点它；如果关闭了对话框，在 **Installed plugins** 中确认 `dsh-why-reject-me` 已打开。
6. 按界面提示重启 DSH Desktop。Host 半在启动时加载，只刷新 Desktop 页面可能不够。

**让 Agent 安装：**

在启用了 `plugin_manager` 工具的会话（默认是 Creator 模式）中，直接发：

```text
请在我的 DSH profile 中安装这个插件：
plugin_manager action=install_bundle target=git+https://github.com/Jorgen233/dsh-why-reject-me.git

安装完成后确认 bundle 已启用，并告诉我是否需要重启 DSH Desktop。
```

如果当前会话没有 `plugin_manager`，改用 DSH Desktop 的 Plugins 页面。

### 方式二：本地克隆 / 开发

适合需要改代码或调试插件，并且已经能取得仓库副本的情况。

```bash
git clone https://github.com/Jorgen233/dsh-why-reject-me.git
```

然后在 **Plugins → Add plugin** 中填入克隆目录的**绝对路径**，例如：

```text
G:\Dev\dsh-why-reject-me
```

本地路径会以 `link:` 方式装入 profile，修改 `client.js` 后刷新 Desktop 页面即可生效；修改 `index.js` 后需要重启 Desktop。

> 本地安装要先有仓库副本。如果 GitHub 无法直接访问，需要先通过代理、镜像或其他方式取得副本，再填本地路径；直接 `git clone` 仓库地址仍然需要能访问 GitHub。

### 更新

GitHub 安装：

```text
plugin_manager action=remove_bundle target=dsh-why-reject-me
plugin_manager action=install_bundle target=git+https://github.com/Jorgen233/dsh-why-reject-me.git
```

在 DSH Desktop 中等价于：在 **Plugins** 里卸载后重新 **Add plugin**。本地路径安装同理，把 target 换回对应的路径即可。更新 Host 半后需要重启 DSH Desktop。

### 确认安装

- **Plugins** 列表中能看到 `dsh-why-reject-me`，且开关为开启状态；
- 把会话权限切到 `danger-full-access`，让 Agent 运行一条只读命令，或触发任意会弹出审批的操作；
- 审批面板中应出现「拒绝原因（可选）」输入框；
- 输入原因并拒绝后，展开对应的工具结果卡片，应能看到原因文本。

## 使用

1. Agent 请求越权执行，审批面板出现；
2. 在「拒绝原因（可选）」中填写原因，可以留空；
3. 点「拒绝」，或按 `Ctrl/⌘ + Enter`；
4. 原因会先提交给 Host，随后审批才以 `rejected` 结束；
5. 模型在同一个 tool result 中读到原因，并据此继续。

原因只在**拒绝**时发送。点「允许一次」不会发送输入框里的内容。

如果原因提交失败，审批不会自动结束，面板会显示错误并允许重试；此时可以重试，或清空原因后直接拒绝。

## 快捷键

| 按键 | 行为 |
| --- | --- |
| `Enter`（焦点不在输入框或按钮上） | 允许一次 |
| `Ctrl/⌘ + Enter` | 拒绝并附上原因 |
| `Esc`（焦点在输入框且有内容） | 让输入框失焦，避免误触拒绝 |
| `Esc`（输入框为空） | 直接拒绝 |

输入法组合输入期间按 `Enter` 不会触发审批动作。

## 工作原理

1. 客户端接管 `conversation.composer` 上的审批面板，只在「待处理交互是审批」且「不是子代理会话」时生效；
2. 点拒绝且原因非空时，客户端把 `{ sessionId, callId, reason, prefix }` POST 到 Host 的 `/api/dsh-why-reject-me/reason`；
3. Host 在内存中按 `Session + Tool call` 暂存原因，5 分钟内未匹配到拒绝结果就丢弃；
4. 客户端调用原审批对象的 `answer('rejected')`；
5. 拒绝结果产生后，Host 的 `tools/post-execute` 监听器把原因追加到这条 tool result 的 content；
6. 模型像读 `ask_user_question` 的答案一样读到它——它是普通工具结果，不是一条 `user/message`，也不会单独起一轮。

插件不修改任何 DSH 自带包，Host 半只注册一个同源路由和一个 `tools/post-execute` 监听器。

## 兼容性

- 验证环境：DSH Desktop `0.2.1-rc.2` 和 `0.2.1-rc.5`；两个版本都做过真实审批验证，其他运行方式未验证；
- 依赖以下公开面：
  - `conversation.composer` 链式插槽与 `priority`；
  - `PendingApproval.kind / answer / callId / key`；
  - `ctx.connection.fetch.register`；
  - `tools/post-execute` waterfall；
  - `SessionSnapshot.subagent`。
- DSH 大版本升级后，如果这些公开面发生变化，插件可能需要同步适配。升级 DSH 后若审批面板异常，先禁用本插件，确认是否为兼容性问题。

## 已知限制

- 原因会作为 tool result 的一部分进入会话记录（`tool/result`），并随上下文发送给模型提供商。这是「模型可见」的必要代价，无法既让模型读到、又完全不落盘；
- 展开被拒绝工具的结果卡片时，可以看到这段原因；
- **子代理会话不适用**：运行时会在子代理上下文中自动拒绝提权，插件不会接管这类审批，因此没有原因输入框，拒绝文案仍是运行时原文（`the user rejected ...`，与人工拒绝同文）。这是 DSH 核心策略，不是本插件能改的；
- 原因上限 2000 字；Host 暂存 5 分钟未匹配到拒绝结果就丢弃；
- 未发送的草稿按 `Session + Tool call` 保留 30 分钟：切到其他会话再回来不会丢字，但刷新 Desktop 页面会丢（只存在页面内存里）；
- 只处理权限审批，不处理 `ask_user_question` 或其他确认框；
- 原因只是附加文本，模型会读到，但不保证一定照做；
- 插件通过 `priority: 0` 接管审批面板。如果同时安装了其他抢占 `conversation.composer` 的审批插件，可能只有其中一个生效。

## 卸载与回滚

在 **Plugins** 页面把 `dsh-why-reject-me` 关闭或卸载，然后重启 DSH Desktop。

也可以用 Agent 工具：

```text
plugin_manager action=set_bundle target=dsh-why-reject-me enabled=false
# 或
plugin_manager action=remove_bundle target=dsh-why-reject-me
```

卸载后审批面板恢复为 DSH 自带样式，已经写入会话记录的原因不会被删除。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 安装后审批面板没有变化 | 确认 bundle 已启用；重启 DSH Desktop，而不是只刷新 Desktop 页面 |
| 有输入框，但模型没看到原因 | 确认点的是「拒绝」且原因非空；原因提交失败时面板会报错并停在审批上；展开工具结果卡片查看原文 |
| 点拒绝后一直停在「正在提交原因…」 | Host 路由没有响应；重启 Desktop，并检查是否有代理或安全软件拦截同源 POST |
| 子代理会话没有输入框 | 预期行为，见[已知限制](#已知限制) |
| 刷新 Desktop 页面后草稿丢了 | 预期行为，草稿只存在页面内存中 |
| GitHub 安装失败或超时 | 确认本机有 Git、能访问 GitHub；或先取得仓库副本后填本地路径 |
| 插件列表显示的不是英文名 | 升级到 `0.3.2` 或更新版本，并重启 Desktop 清除旧元数据缓存 |
| 和其他审批插件冲突 | 只保留一个接管 `conversation.composer` 的审批插件 |

## 开发与测试

插件是纯 ESM JavaScript，不需要构建，也没有运行时依赖。测试需要 Node.js 20 或更新版本，只使用 Node 内置模块，克隆后无需先安装依赖。

```bash
git clone https://github.com/Jorgen233/dsh-why-reject-me.git
cd dsh-why-reject-me
npm test
```

`npm test` 依次运行三个冒烟测试：

```text
node test/smoke-client.mjs
node test/smoke-panel.mjs
node test/smoke-host.mjs
```

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：原因暂存路由、`tools/post-execute` 追加逻辑 |
| `client.js` | 客户端半（Desktop 内嵌页面）：审批面板、草稿、POST、快捷键 |
| `cordis.patch.yml` | 向 profile 插入插件行 |
| `locale/` | 插件列表的显示元数据 |
| `test/` | 不依赖 DSH 运行时的冒烟测试 |

三个测试分别覆盖：插槽注册与 POST 形状、面板交互与草稿生命周期、Host 路由校验与 tool result 追加。真实 Desktop 行为仍需安装后手测：

1. 触发一次需要审批的操作；
2. 输入原因并拒绝，确认 tool result 末尾出现原因；
3. 再次触发审批，留空拒绝，确认与原生一致；
4. 输入原因后切到其他会话再回来，确认草稿还在。

## 许可证

[MIT](LICENSE)，Copyright (c) 2026 Jorgen233。

## 关于本项目

本项目完全由 DeepSeek 搭建和维护。

它是第三方社区插件，不是 DSH 官方组件。欢迎通过 GitHub Issues 反馈问题；涉及 DSH 公开面的兼容性调整，会随 DSH 版本变化更新。

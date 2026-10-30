# dsh-why-reject-me

[简体中文](README.md) | English

Adds an optional "rejection reason" field to DSH permission approval prompts. When you reject a request, the reason is attached to the rejected tool's **tool result** for the model; leaving the field empty keeps the native behavior exactly as it was.

> The code, tests, and documentation of this project are built and maintained entirely by DeepSeek.

Status: `v0.3.2`; a real approval flow and an agent-driven install from GitHub have been verified on DSH Desktop `0.2.1-rc.5`.

## Contents

- [Why this plugin exists](#why-this-plugin-exists)
- [What it looks like](#what-it-looks-like)
- [Install](#install)
- [Usage](#usage)
- [Shortcuts](#shortcuts)
- [How it works](#how-it-works)
- [Compatibility](#compatibility)
- [Known limitations](#known-limitations)
- [Uninstall and rollback](#uninstall-and-rollback)
- [Troubleshooting](#troubleshooting)
- [Development and tests](#development-and-tests)
- [License](#license)
- [About](#about)

## Why this plugin exists

DSH's native approval prompt has only two actions: **Allow once** and **Reject**. The model knows that a request was rejected, but not why: the path may be wrong, the command may be too dangerous, or the rejection may be a deliberate test.

Typical cases:

- You do not want to grant a permission, but want the model to try a different approach;
- You are testing the permission flow and need to say explicitly that the rejection is intentional;
- You want the model to explain its plan or show a diff before you decide;
- The reason itself is input for the next step, not an unrelated note.

This plugin adds an optional field to the approval panel and delivers the reason where the model can read it, without adding a user message or an extra turn.

## What it looks like

After you enter a reason and click **Reject**, the tool result the model receives ends with:

```text
[Approval request rejected] Reason: Don't touch the system directory yet; send me the diff first.
```

| Action | Result |
| --- | --- |
| Enter a reason → Reject | The reason is appended to that tool's result; the model reads it in the same turn |
| Leave the field empty → Reject | Identical to a native rejection; nothing extra is sent |
| Allow once | Native behavior; the field content is not sent |

The prefix follows the UI language: `[Approval request rejected] Reason: ` in English, `【审批请求已拒绝】原因：` in Chinese.

## Install

Install from GitHub, or clone the repository for local development and debugging.

### Requirements

- **DSH Desktop.** The plugin runs in the approval panel embedded in DSH Desktop, and this project is verified only on Desktop. `dsh-TUI` does not use this panel.
- Verified on DSH Desktop `0.2.1-rc.5`; see [Compatibility](#compatibility) for other versions.
- Installing from GitHub requires **Git** and network access to GitHub.
- Installation changes the current profile and **affects every session in that profile**.
- The plugin runs as a Host plugin inside the DSH process; install it only from this repository or a copy you trust.

### Option 1: Install from GitHub (recommended)

**In DSH Desktop:**

1. Open DSH Desktop and go to **Plugins** in the left sidebar.
2. Click **Add plugin** → **Install a third-party plugin**.
3. Enter the repository URL:

   ```text
   git+https://github.com/Jorgen233/dsh-why-reject-me.git
   ```

4. Click **Install**.
5. If **Enable now** appears, click it. If you closed the dialog, make sure `dsh-why-reject-me` is switched on under **Installed plugins**.
6. Restart DSH Desktop when prompted. The Host half loads at startup, so reloading the Desktop page may not be enough.

**Ask an agent to install it:**

In a session where the `plugin_manager` tool is available (Creator mode by default), send:

```text
Install this plugin in my DSH profile:
plugin_manager action=install_bundle target=git+https://github.com/Jorgen233/dsh-why-reject-me.git

After installation, confirm the bundle is enabled and tell me whether I need to restart DSH Desktop.
```

If `plugin_manager` is not available in the current session, use the Plugins page in DSH Desktop instead.

### Option 2: Local clone / development

Use this when you need to change the code or debug the plugin and already have a copy of the repository.

```bash
git clone https://github.com/Jorgen233/dsh-why-reject-me.git
```

Then use **Plugins → Add plugin** and enter the **absolute path** of the clone, for example:

```text
G:\Dev\dsh-why-reject-me
```

Local paths are installed as a `link:` dependency. Changes to `client.js` take effect after reloading the Desktop page; changes to `index.js` require restarting DSH Desktop.

> A local install still needs a repository copy first. If GitHub is not directly reachable, obtain a copy through a proxy, mirror, or another channel and install from that path; `git clone` against the GitHub URL itself still requires access to GitHub.

### Update

For a GitHub install:

```text
plugin_manager action=remove_bundle target=dsh-why-reject-me
plugin_manager action=install_bundle target=git+https://github.com/Jorgen233/dsh-why-reject-me.git
```

In DSH Desktop, the equivalent is to uninstall the bundle under **Plugins** and then **Add plugin** again. The same applies to a local path: point the target back to that path. Restart DSH Desktop after updating the Host half.

### Verify the installation

- `dsh-why-reject-me` appears in the **Plugins** list and its switch is on;
- set the session permission to `danger-full-access` and ask the agent to run a read-only command, or trigger any operation that opens an approval prompt;
- the approval panel shows a **Rejection reason (optional)** field;
- enter a reason and reject, then expand the corresponding tool result; the reason should be visible there.

## Usage

1. The agent requests privileged execution, and the approval panel appears;
2. Enter a reason in **Rejection reason (optional)**, or leave it empty;
3. Click **Reject**, or press `Ctrl/⌘ + Enter`;
4. The reason is submitted to the Host before the approval ends as `rejected`;
5. The model reads the reason in the same tool result and continues from there.

The reason is sent only when you click **Reject**. **Allow once** never sends the field content.

If submitting the reason fails, the approval does not end; the panel shows the error and lets you retry, or clear the field and reject without a reason.

## Shortcuts

| Key | Action |
| --- | --- |
| `Enter` (focus is not in the field or on a button) | Allow once |
| `Ctrl/⌘ + Enter` | Reject with the reason |
| `Esc` (focus is in the field and the field has content) | Blur the field, avoiding an accidental rejection |
| `Esc` (field is empty) | Reject directly |

Pressing `Enter` while an IME composition is active does not trigger an approval action.

## How it works

1. The client takes over the approval panel on `conversation.composer`, only when the pending interaction is an approval and the session is not a subagent session;
2. When you reject with a non-empty reason, the client POSTs `{ sessionId, callId, reason, prefix }` to the Host route `/api/dsh-why-reject-me/reason`;
3. The Host parks the reason in memory, keyed by `Session + Tool call`, and drops it after 5 minutes if no rejected result matches;
4. The client calls the original approval object's `answer('rejected')`;
5. When the rejected result is produced, the Host's `tools/post-execute` listener appends the reason to that tool result's content;
6. The model reads it like an `ask_user_question` answer — it is an ordinary tool result, not a `user/message`, and it does not start a separate turn.

The plugin does not modify any package shipped with DSH; the Host half registers one same-origin route and one `tools/post-execute` listener.

## Compatibility

- Verified environments: DSH Desktop `0.2.1-rc.2` and `0.2.1-rc.5`; both have been tested with a real approval flow, and other run modes are unverified;
- Depends on the following public surfaces:
  - the `conversation.composer` chain slot and `priority`;
  - `PendingApproval.kind / answer / callId / key`;
  - `ctx.connection.fetch.register`;
  - the `tools/post-execute` waterfall;
  - `SessionSnapshot.subagent`.
- After a major DSH upgrade, these public surfaces may change and the plugin may need an update. If the approval panel misbehaves after upgrading DSH, disable the plugin first to check whether the cause is compatibility.

## Known limitations

- The reason becomes part of the tool result, enters the session log (`tool/result`), and is sent to the model provider with the context. This is the necessary cost of making it visible to the model; it cannot be both readable by the model and completely absent from storage;
- Expanding the rejected tool's result card can reveal the reason;
- **Not available in subagent sessions**: the runtime automatically rejects escalation in subagent contexts, so the plugin does not take over those approvals. There is no reason field, and the rejection text remains the runtime's original text (`the user rejected ...`, identical to a manual rejection). This is core DSH policy, not something this plugin can change;
- The reason is limited to 2000 characters; the Host drops it after 5 minutes if no rejected result matches;
- An unsent draft is kept per `Session + Tool call` for 30 minutes: switching to another session and back does not lose it, but reloading the Desktop page does (it lives only in page memory);
- Only permission approvals are handled; `ask_user_question` and other confirmation prompts are not;
- The reason is plain appended text: the model reads it, but is not guaranteed to follow it;
- The plugin takes over the approval panel at `priority: 0`. If another approval plugin also claims `conversation.composer`, only one of them may take effect.

## Uninstall and rollback

Turn `dsh-why-reject-me` off or uninstall it on the **Plugins** page, then restart DSH Desktop.

You can also use the agent tool:

```text
plugin_manager action=set_bundle target=dsh-why-reject-me enabled=false
# or
plugin_manager action=remove_bundle target=dsh-why-reject-me
```

After uninstalling, the approval panel returns to the native DSH style. Reasons already written to session logs are not deleted.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| The approval panel does not change after installation | Confirm the bundle is enabled; restart DSH Desktop instead of only reloading the Desktop page |
| The field is present but the model does not see the reason | Confirm you clicked **Reject** and the reason was not empty; if submission fails, the panel reports an error and stays on the approval; expand the tool result card to inspect the raw text |
| Rejecting stays on "Submitting rejection reason…" | The Host route is not responding; restart Desktop and check whether a proxy or security tool is blocking the same-origin POST |
| No field in a subagent session | Expected behavior; see [Known limitations](#known-limitations) |
| The draft is lost after reloading the Desktop page | Expected behavior; drafts live only in page memory |
| GitHub install fails or times out | Check that Git is installed and GitHub is reachable; or obtain a repository copy first and install from its local path |
| The plugin list still shows a Chinese title | Upgrade to `0.3.2` or newer and restart Desktop to clear the old metadata cache |
| Conflict with another approval plugin | Keep only one plugin that takes over `conversation.composer` |

## Development and tests

The plugin is plain ESM JavaScript. It needs no build step and has no runtime dependencies. Tests require Node.js 20 or newer and use only Node built-ins, so no dependency install is needed after cloning.

```bash
git clone https://github.com/Jorgen233/dsh-why-reject-me.git
cd dsh-why-reject-me
npm test
```

`npm test` runs three smoke tests in order:

```text
node test/smoke-client.mjs
node test/smoke-panel.mjs
node test/smoke-host.mjs
```

| File | Purpose |
| --- | --- |
| `index.js` | Host half: the reason-parking route and the `tools/post-execute` append logic |
| `client.js` | Client half (Desktop embedded page): approval panel, drafts, POST, shortcuts |
| `cordis.patch.yml` | Inserts the plugin row into the profile |
| `locale/` | Display metadata for the plugin list |
| `test/` | Smoke tests that do not require the DSH runtime |

Together the three tests cover: slot registration and POST shape, panel interaction and draft lifecycle, and Host route validation and tool-result appending. Real Desktop behavior still needs a manual check after installation:

1. Trigger an operation that requires approval;
2. Enter a reason and reject; confirm the reason appears at the end of the tool result;
3. Trigger approval again, reject with an empty field, and confirm the result matches native behavior;
4. Enter a reason, switch to another session, and come back; confirm the draft is still there.

## License

[MIT](LICENSE), Copyright (c) 2026 Jorgen233.

## About

Built and maintained entirely by DeepSeek.

It is a third-party community plugin, not an official DSH component. Please use GitHub Issues for feedback; compatibility work for DSH public surfaces will follow DSH releases.

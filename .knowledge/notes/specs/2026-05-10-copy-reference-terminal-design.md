# Copy Reference to Terminal — Design Spec

## Overview
Modify `copyCodeReference.copy` (Alt+3) to send the generated `@file#Lline-range` reference to the active terminal when that terminal is running Claude Code CLI (`claude`).

## Current Behavior
- Alt+3 copies `@file#Lline-range` to the clipboard.
- No interaction with the terminal.

## Desired Behavior
- Alt+3 still copies `@file#Lline-range` to the clipboard (existing behavior preserved).
- After copying, if there is an active terminal whose foreground process is `claude`, send the same reference string to that terminal via `sendText(..., false)`.
- If any step of the terminal detection fails (no active terminal, cannot get PID, `ps` fails, process name is not `claude`), silently skip the terminal send. The clipboard copy must always succeed.

## Process Detection
- Use `vscode.window.activeTerminal.processId` to get the terminal PID.
- Run `ps -p <pid> -o comm=` to get the foreground process name.
- Match exactly against `'claude'`.
- Detection is WSL/Linux only (the extension already targets WSL for pasteImage).

## Error Handling
| Condition | Behavior |
|-----------|----------|
| No active terminal | Skip terminal send |
| processId is undefined | Skip terminal send |
| `ps` command throws | Skip terminal send |
| Process name !== `'claude'` | Skip terminal send |
| Clipboard write fails | Silently ignore (existing behavior) |
| Terminal send fails | Silently ignore |

## Files to Change
- `src/commands/copyReference.ts` — add process detection and terminal send logic.
- `src/extension.ts` — may need to pass `outputChannel` to `copyReference` for debug logging (optional).

## Out of Scope
- No new commands or keybindings.
- No configuration settings.
- No support for macOS/Windows process detection.
- No detection of `claude` as a child/subprocess; only foreground process.

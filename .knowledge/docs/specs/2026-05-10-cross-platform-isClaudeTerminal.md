# Cross-Platform isClaudeTerminal Compatibility

## Problem

The `isClaudeTerminal` function in `src/commands/copyReference.ts` uses `ps --ppid` to query child processes of the active terminal. This only works on Linux (GNU ps). It fails on:

- **macOS**: BSD `ps` does not support `--ppid`
- **Windows**: `ps` command does not exist

When the check fails, the extension silently skips sending the `@file#Lline` reference to the terminal — the clipboard copy still works, but the auto-send feature is broken on macOS and Windows.

## Goals

1. Make `isClaudeTerminal` work correctly on Linux, macOS, and Windows
2. Keep zero external dependencies
3. Maintain existing silent-failure behavior (don't crash if process query fails)
4. Fix the existing case-sensitivity bug in process name comparison (`Claude` vs `claude`)

## Non-Goals

- Recursive child process detection (only direct children)
- Changing clipboard behavior
- Adding tests (the project has no test infrastructure)

## Design

### Platform Commands

| Platform | Check Self Process | Check Child Processes |
|----------|-------------------|----------------------|
| Linux | `ps -p ${pid} -o comm=` | `ps --ppid ${pid} -o comm=` |
| macOS | `ps -p ${pid} -o comm=` | `pgrep -P ${pid} -l` |
| Windows | PowerShell `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" \| Select-Object -ExpandProperty Name` | PowerShell `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" \| Select-Object -ExpandProperty Name` |

### Functions

Add two helper functions:

- `getProcessName(pid: number): Promise<string | null>` — returns lowercase process name or null on failure
- `getChildProcessNames(pid: number): Promise<string[]>` — returns array of lowercase child process names, empty on failure

Refactor `isClaudeTerminal` to call these helpers instead of inline `execPromise` calls.

### Case Sensitivity

All process names are converted to lowercase before comparison. The check `=== 'claude'` is case-insensitive in effect.

## Files Changed

- `src/commands/copyReference.ts` — add helpers, refactor `isClaudeTerminal`

## Verification

- `npm run compile` must pass without errors
- No runtime behavior change on Linux

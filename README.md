# Copy Code Reference

VS Code extension to copy `@file:line-range` references and paste image paths in terminal.

## Commands

### Copy Code Reference

1. Select code (or place cursor on a line)
2. Press `Alt+3`
3. Paste anywhere — reference is in clipboard

**Format:**

- `@src/utils.ts:10-25` — multi-line selection
- `@src/utils.ts:10` — single line or cursor
- Absolute path fallback when no workspace is open

### Paste Image Reference

Paste a clipboard image as a file path reference into the active terminal. Only available in **WSL Remote** environments.

1. Copy an image to clipboard
2. Focus the terminal where you want to paste
3. Press `Alt+4`

The image will be saved to a temporary file and its path (e.g., `@/tmp/image_xxx.png`) will be sent to the terminal.

**Note:** The extension automatically registers `copyCodeReference.pasteImage` in `terminal.integrated.commandsToSkipShell` so that `Alt+4` works when the terminal is focused. If you have custom needs, you can still override this in your `settings.json`.

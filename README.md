# Copy Code Reference

VS Code extension to copy `@file:line-range` references.

## Usage

1. Select code (or place cursor on a line)
2. Press `Alt+3`
3. Paste anywhere — reference is in clipboard

## Format

- `@src/utils.ts:10-25` — multi-line selection
- `@src/utils.ts:10` — single line or cursor
- Absolute path fallback when no workspace is open

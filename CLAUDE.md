# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A minimal VS Code extension that copies `@file:line-range` references to the clipboard. Activated via `Alt+3` or the command palette (`Copy Code Reference`).

## Development Commands

| Task | Command |
|------|---------|
| Compile | `npm run compile` |
| Watch mode | `npm run watch` |
| Package for publishing | `npx vsce package` |

The extension has no test suite and no linting configuration.

## Architecture

The entire extension lives in a single file:

- `src/extension.ts` — registers one command (`copyCodeReference.copy`) that reads the active editor's selection, resolves the file path (relative to workspace root when available, absolute otherwise), formats it as `@path:line` or `@path:start-end`, and writes it to the clipboard.

The compiled output goes to `out/extension.js` (driven by `tsconfig.json`). The extension manifest in `package.json` defines the activation event, command, and keybinding.

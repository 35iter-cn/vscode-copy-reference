# Unit Test Framework with Jest

## Problem

The project has zero tests. Recent cross-platform changes to `isClaudeTerminal` introduced platform-specific shell commands that are impossible to verify without running on each target OS. We need a fast, repeatable way to verify logic correctness without requiring Linux/macOS/Windows machines.

## Goals

1. Add Jest + ts-jest as the unit test runner
2. Write tests for `copyReference` formatting logic (path, line numbers, selection states)
3. Write tests for `isClaudeTerminal` platform branching (mock `os.platform()` and `execPromise` to assert correct commands are issued on linux/darwin/win32)
4. All external dependencies (`vscode` API, `child_process.exec`, `os.platform()`) must be mocked — tests run in Node.js only, no VS Code instance required
5. Add `npm test` script

## Non-Goals

- Integration tests (no `@vscode/test-cli`, no real VS Code instance)
- Testing clipboard write or terminal sendText (these are vscode API calls, mocked only)
- Code coverage thresholds
- CI/CD pipeline setup

## Design

### Test Stack

| Package | Purpose |
|---------|---------|
| `jest` | Test runner |
| `ts-jest` | TypeScript transpilation |
| `@types/jest` | Type definitions |

### File Structure

```
src/
  commands/
    copyReference.ts       (existing, will be refactored for testability)
  __tests__/
    copyReference.test.ts
```

### Refactoring for Testability

`copyReference.ts` currently has all helper functions (`execPromise`, `getProcessName`, `getChildProcessNames`, `isClaudeTerminal`) in the same file and exports only `copyReference`. To test them without exposing internals publicly, we extract platform-agnostic helpers into a separate file.

**New file:** `src/commands/terminalDetection.ts`
- Exports: `getProcessName(pid)`, `getChildProcessNames(pid)`, `isClaudeTerminal(terminal)`
- Contains all `os` and `child_process` dependencies

**Modified file:** `src/commands/copyReference.ts`
- Imports `isClaudeTerminal` from `./terminalDetection`
- Retains `copyReference` export and clipboard/terminal-send logic
- `execPromise` stays here if only `copyReference` uses it (it doesn't currently)

### Test Cases

#### `copyReference.test.ts`

**Setup:** Mock `vscode` module entirely. Mock `vscode.env.clipboard.writeText` and `vscode.window.activeTerminal.sendText`.

**Tests for `copyReference`:**

1. `should format @path with no selection` — empty selection → `@/workspace/file.ts`
2. `should format @path#Lline with single-line selection` → `@/workspace/file.ts#L5`
3. `should format @path#Lstart-end with multi-line selection` → `@/workspace/file.ts#L3-7`
4. `should use absolute path when no workspace` — `document.uri.fsPath` used directly
5. `should normalize backslashes to forward slashes` — Windows path `C:\foo\bar.ts` → `C:/foo/bar.ts`
6. `should not send to terminal when isClaudeTerminal returns false`
7. `should send to terminal when isClaudeTerminal returns true`

**Tests for `isClaudeTerminal` (via `terminalDetection.ts`):**

Setup for each test: mock `os.platform()` and `execPromise`, create a mock `vscode.Terminal` with a `processId`.

8. `should return true when terminal process itself is claude on Linux`
9. `should return true when child process is claude on Linux`
10. `should use pgrep on macOS`
11. `should use powershell on Windows`
12. `should return false when no pid`
13. `should return false on error`

### Mock Strategy

```typescript
// Mock vscode module
jest.mock('vscode', () => ({
  window: { activeTextEditor: null, activeTerminal: null },
  env: { clipboard: { writeText: jest.fn() } },
  Terminal: class MockTerminal {
    constructor(public name: string, public processId: number | undefined) {}
    sendText = jest.fn();
  },
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, opts, cb) => {
    // test can set mockExecImplementation before calling function
  }),
}));

// Mock os
jest.mock('os', () => ({
  platform: jest.fn(),
}));
```

### Test Script

```json
"scripts": {
  "test": "jest"
}
```

### Jest Configuration

Use `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
  },
};
```

Or inline in `package.json`:

```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node"
}
```

## Files Changed

- `package.json` — add `jest`, `ts-jest`, `@types/jest` to devDependencies; add `test` script
- `src/commands/terminalDetection.ts` — **new**; extracted from `copyReference.ts`
- `src/commands/copyReference.ts` — import `isClaudeTerminal` from `./terminalDetection`
- `src/__tests__/copyReference.test.ts` — **new**; test suite
- `jest.config.js` — **new**; Jest configuration

## Verification

- `npm install` succeeds
- `npm test` runs and all tests pass
- `npm run compile` still passes (TypeScript compilation unaffected)

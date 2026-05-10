# Copy Reference Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `copyReference` to always use absolute paths and omit line numbers when no text is selected.

**Architecture:** Modify `src/commands/copyReference.ts` in-place. Delete relative-path resolution logic and add a `selection.isEmpty` check before formatting the line-number suffix.

**Tech Stack:** TypeScript, VS Code Extension API

---

### Task 1: Update Path Resolution to Always Use Absolute Path

**Files:**
- Modify: `src/commands/copyReference.ts:52-61`

- [ ] **Step 1: Remove relative path logic**

Replace the conditional path resolution (lines 52-61) with unconditional absolute path usage:

```typescript
// Before:
let filePath: string;
const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
if (workspaceFolder) {
  filePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
  filePath = filePath.replace(/\\/g, '/');
} else {
  filePath = document.uri.fsPath.replace(/\\/g, '/');
}

// After:
const filePath = document.uri.fsPath.replace(/\\/g, '/');
```

This removes the `path` import dependency entirely. Also remove `import * as path from 'path';` from line 2.

- [ ] **Step 2: Verify compilation**

Run: `npm run compile`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/copyReference.ts
git commit -m "feat: always use absolute path in copy reference"
```

---

### Task 2: Omit Line Numbers on Empty Selection

**Files:**
- Modify: `src/commands/copyReference.ts:63-69`

- [ ] **Step 1: Add empty-selection check**

Replace the reference formatting block (lines 63-69) with conditional logic:

```typescript
// Before:
let reference: string;
if (startLine === endLine) {
  reference = `@${filePath}#L${startLine}`;
} else {
  reference = `@${filePath}#L${startLine}-${endLine}`;
}

// After:
let reference: string;
if (selection.isEmpty) {
  reference = `@${filePath}`;
} else if (startLine === endLine) {
  reference = `@${filePath}#L${startLine}`;
} else {
  reference = `@${filePath}#L${startLine}-${endLine}`;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run compile`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/copyReference.ts
git commit -m "feat: omit line numbers when no text is selected"
```

---

### Task 3: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Review the final file**

Read `src/commands/copyReference.ts` and confirm:
1. The `path` import is removed.
2. `filePath` is always derived from `document.uri.fsPath`.
3. `selection.isEmpty` determines whether line numbers are included.
4. Terminal integration (`isClaudeTerminal` + `sendText`) is untouched.

- [ ] **Step 2: Compile one final time**

Run: `npm run compile`
Expected: Clean compile.

- [ ] **Step 3: Confirm no other files changed**

Run: `git diff --stat`
Expected: Only `src/commands/copyReference.ts` shows modifications.

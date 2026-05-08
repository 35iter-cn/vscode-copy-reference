# Copy Reference Format Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the copied reference format from `@file:line` / `@file:start-end` to `@file#Lline` / `@file#Lstart-end`.

**Architecture:** Single-file change in `src/extension.ts`. The file path resolution logic stays unchanged; only the final string formatting is updated.

**Tech Stack:** TypeScript, VS Code Extension API

---

### Task 1: Verify Current Build

**Files:**
- Read: `src/extension.ts` (confirm current state)

- [ ] **Step 1: Compile the project**

Run: `npm run compile`
Expected: Clean compilation with no errors.

- [ ] **Step 2: Commit baseline (if needed)**

If there are uncommitted changes, stage and commit them first.

---

### Task 2: Update Format Logic

**Files:**
- Modify: `src/extension.ts:30-35`

- [ ] **Step 1: Change the format strings**

Replace lines 30-35 in `src/extension.ts`:

```typescript
// OLD
    // Format: @file:line or @file:start-end
    let reference: string;
    if (startLine === endLine) {
      reference = `@${filePath}:${startLine}`;
    } else {
      reference = `@${filePath}:${startLine}-${endLine}`;
    }
```

With:

```typescript
    // Format: @file#Lline or @file#Lstart-end
    let reference: string;
    if (startLine === endLine) {
      reference = `@${filePath}#L${startLine}`;
    } else {
      reference = `@${filePath}#L${startLine}-${endLine}`;
    }
```

- [ ] **Step 2: Update the comment on line 29**

Change `// Format: @file:line or @file:start-end` to `// Format: @file#Lline or @file#Lstart-end`.

---

### Task 3: Verify and Commit

**Files:**
- Verify: `src/extension.ts`

- [ ] **Step 1: Recompile**

Run: `npm run compile`
Expected: Clean compilation with no errors.

- [ ] **Step 2: Review the diff**

Run: `git diff src/extension.ts`
Expected: Only the format strings and comment changed.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: update reference format to GitHub style

Change @file:line to @file#Lline and @file:start-end to @file#Lstart-end.
This matches the standard GitHub/GitLab line reference convention."
```

---

## Self-Review

**Spec coverage:** The spec asks to change `@file:line` to `@file#Lline` and `@file:start-end` to `@file#Lstart-end`. Task 2 directly implements this.

**Placeholder scan:** No TBD, TODO, or vague steps. All code is exact.

**Type consistency:** No new types or functions introduced. Existing variables `filePath`, `startLine`, `endLine` are used unchanged.

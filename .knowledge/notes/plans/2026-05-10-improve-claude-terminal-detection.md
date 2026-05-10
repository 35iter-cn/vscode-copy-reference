# 改进 isClaudeTerminal 子进程检测 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改进 `isClaudeTerminal` 函数，使其同时检查 terminal 进程的直接子进程中是否包含 `claude`。

**架构：** 在现有的 `ps -p` 检测基础上，增加 `ps --ppid` 检测直接子进程。任一匹配即认为该 terminal 正在运行 Claude。

**技术栈：** TypeScript, VS Code Extension API, Node.js `child_process`

---

### Task 1: 修改 isClaudeTerminal 函数

**Files:**
- Modify: `src/commands/copyReference.ts:17-29`

- [ ] **Step 1: 修改 `isClaudeTerminal` 函数**

  将函数从仅检查进程本身名称，改为同时检查直接子进程名称：

  ```typescript
  async function isClaudeTerminal(terminal: vscode.Terminal): Promise<boolean> {
    const pid = await terminal.processId;
    if (!pid) {
      return false;
    }
    try {
      // Check the terminal process itself
      const { stdout: selfStdout } = await execPromise(`ps -p ${pid} -o comm=`);
      const selfName = selfStdout.trim();
      if (selfName === 'claude') {
        return true;
      }

      // Check direct child processes
      const { stdout: childrenStdout } = await execPromise(`ps --ppid ${pid} -o comm=`);
      const childNames = childrenStdout.trim().split('\n').map(s => s.trim()).filter(Boolean);
      return childNames.includes('claude');
    } catch {
      return false;
    }
  }
  ```

- [ ] **Step 2: 编译验证**

  Run: `npm run compile`
  Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

  ```bash
  git add src/commands/copyReference.ts
  git commit -m "fix: detect claude in direct child processes of terminal

  The previous implementation only checked the terminal process itself,
  missing cases where claude is spawned as a child of the shell."
  ```

---

## Self-Review

1. **Spec coverage:** 设计要求的"检查直接子进程"已在 Task 1 中实现。
2. **Placeholder scan:** 无 TBD/TODO/模糊描述，代码完整。
3. **Type consistency：** 函数签名未变更，返回类型仍为 `Promise<boolean>`，与调用方兼容。

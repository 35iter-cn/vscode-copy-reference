# pasteImage 跨平台扩展设计

## 目标

将 `pasteImage` 命令从仅支持 WSL Remote 扩展到原生 macOS 和原生 Windows，同时保持 Linux 扩展的预留接口。

## 架构

采用**平台分发器模式**：平台相关的"剪贴板读取"与平台无关的"保存+发送"完全解耦。

```
src/
  clipboard/
    reader.ts              # 抽象接口 + 工厂函数
    macos-reader.ts        # macOS osascript 实现
    windows-reader.ts      # Windows PowerShell 实现
    wsl-reader.ts          # WSL 跨系统 PowerShell 实现（从现有代码提取）
  commands/
    pasteImage.ts          # 平台无关：调用工厂 -> 读取 -> 保存 -> 发送
```

## 数据流

1. `pasteImage` 命令调用 `createClipboardReader()`
2. 工厂根据 `vscode.env.remoteName`（WSL）和 `process.platform`（darwin / win32）返回对应 Reader
3. `pasteImage` 调用 `reader.read(outputChannel)`
4. Reader 执行平台特定的命令，将图片转为 base64，stdout 输出 `OK:<base64>` 或 `NO_IMAGE`
5. `pasteImage` 解析 base64，解码为 Buffer，写入临时文件
6. 生成 `@${path}` 引用，发送到当前终端

## 接口定义

```typescript
interface ClipboardReader {
  read(outputChannel: vscode.OutputChannel): Promise<string>;
  // 返回 base64 编码的图片数据
}
```

## 各平台实现

### macOS（macos-reader.ts）

通过 `osascript -l JavaScript` 执行 JXA 脚本读取剪贴板图片：
- 使用 `$.NSPasteboard.generalPasteboard` 读取剪贴板
- 尝试 `NSPasteboardTypePNG`，回退到 `NSPasteboardTypeTIFF`
- 将图片数据转为 base64 字符串，stdout 输出 `OK:<base64>`
- 剪贴板无图片时输出 `NO_IMAGE`
- **依赖**：零，osascript 为 macOS 系统内置
- **权限**：第一次使用时 macOS 可能弹出"允许粘贴"运行时提示，用户点击允许即可；拒绝时 osascript 以非零退出码失败，stderr 输出到 Output Channel

### Windows 原生（windows-reader.ts）

通过 PowerShell 读取剪贴板图片：
- `Add-Type -AssemblyName System.Windows.Forms` + `System.Drawing`
- `Clipboard.GetImage()` 获取图片，保存为 PNG 格式的 MemoryStream
- base64 编码后 stdout 输出 `OK:<base64>`
- 剪贴板无图片时输出 `NO_IMAGE`
- **依赖**：零，PowerShell + .NET Framework 为 Windows 系统内置

### WSL（wsl-reader.ts）

提取现有实现，逻辑不变：
- 跨系统调用 `powershell.exe`
- 执行与 Windows 原生相同的 PowerShell 脚本
- base64 编码后 stdout 输出
- **依赖**：零，WSL 自带 Windows 互操作

## 工厂函数

```typescript
export function createClipboardReader(): ClipboardReader {
  if (vscode.env.remoteName === 'wsl') {
    return new WslClipboardReader();
  }
  switch (process.platform) {
    case 'darwin': return new MacOSClipboardReader();
    case 'win32': return new WindowsClipboardReader();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
```

平台检测规则：
- WSL 优先：`vscode.env.remoteName === 'wsl'`
- 原生平台：`process.platform`，`darwin` → macOS，`win32` → Windows
- `default` 分支为 Linux 预留，当前抛出不支持错误

## 错误处理

| 错误类型 | Reader 行为 | pasteImage 行为 |
|---------|------------|----------------|
| 剪贴板无图片 | 输出 `NO_IMAGE`，解析侧抛出 `No image in clipboard` | 状态栏提示 `No image in clipboard` (3s) |
| 平台不支持 | 工厂抛出 `Unsupported platform: xxx` | 状态栏提示 `Paste image not supported on this platform` (3s) |
| 命令执行失败 | `exec` error 抛出 | 状态栏提示 `Execution failed, see Output panel`，Output Channel 输出完整错误 |
| 意外的 stdout 格式 | 抛出 `Unexpected output` | 同上 |

所有 `exec` 调用的 `maxBuffer` 保持 50MB，与现有实现一致。

## 与现有代码的关系

- `src/clipboard/reader.ts` 中现有的 `readClipboardImage` 函数将被拆分为 WSL Reader 实现 + 公共解析逻辑
- `src/commands/pasteImage.ts` 中的 try/catch 结构和错误提示文案保持不变
- package.json 无需修改（命令和快捷键已注册）

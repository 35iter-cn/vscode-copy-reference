# 为 pasteImage 命令提供默认的 terminal.integrated.commandsToSkipShell 配置

## 背景

`copyCodeReference.pasteImage` 命令使用 `Alt+4` 快捷键将剪贴板图片发送到终端。当终端处于焦点时，VS Code 默认会将快捷键传递给 shell，导致命令无法触发。当前 README 指导用户手动将 `copyCodeReference.pasteImage` 添加到 `terminal.integrated.commandsToSkipShell` 中。

## 目标

通过扩展自动提供该默认配置，使用户安装后无需手动操作即可在终端中使用 `Alt+4`。

## 方案

使用 VS Code 扩展的 `contributes.configurationDefaults` 机制，在 `package.json` 中为 `terminal.integrated.commandsToSkipShell` 提供默认值 `["copyCodeReference.pasteImage"]`。

VS Code 对数组类型的默认配置采用**合并**策略，不会覆盖用户已有的其他命令。

## 改动范围

1. **`package.json`** — 在 `contributes` 中添加 `configurationDefaults`
2. **`README.md`** — 更新说明，告知用户该配置已自动提供

## 验收标准

- 安装扩展后，新工作区中 `terminal.integrated.commandsToSkipShell` 默认包含 `copyCodeReference.pasteImage`
- 用户已有的 `commandsToSkipShell` 配置不会被覆盖
- README 不再要求用户手动添加该配置

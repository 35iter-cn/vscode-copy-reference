import * as vscode from 'vscode';
import { copyReference } from '../commands/copyReference';
import { isClaudeTerminal } from '../commands/terminalDetection';
import { sendToTerminal } from '../utils/terminal';

jest.mock('../commands/terminalDetection');
jest.mock('../utils/terminal');

const mockedIsClaudeTerminal = isClaudeTerminal as jest.MockedFunction<typeof isClaudeTerminal>;
const mockedSendToTerminal = sendToTerminal as jest.MockedFunction<typeof sendToTerminal>;

describe('copyReference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsClaudeTerminal.mockResolvedValue(false);
    (vscode.window as any).activeTextEditor = undefined;
    (vscode.window as any).activeTerminal = undefined;
  });

  function createMockEditor(options: {
    filePath: string;
    startLine: number;
    endLine: number;
    isEmpty: boolean;
  }): vscode.TextEditor {
    return {
      document: {
        uri: {
          fsPath: options.filePath,
        },
      },
      selection: {
        start: { line: options.startLine },
        end: { line: options.endLine },
        isEmpty: options.isEmpty,
      },
    } as unknown as vscode.TextEditor;
  }

  it('should format @path with no selection', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: '/workspace/file.ts',
      startLine: 0,
      endLine: 0,
      isEmpty: true,
    });

    await copyReference();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('@/workspace/file.ts');
  });

  it('should format @path#Lline with single-line selection', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: '/workspace/file.ts',
      startLine: 4,
      endLine: 4,
      isEmpty: false,
    });

    await copyReference();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('@/workspace/file.ts#L5');
  });

  it('should format @path#Lstart-end with multi-line selection', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: '/workspace/file.ts',
      startLine: 2,
      endLine: 6,
      isEmpty: false,
    });

    await copyReference();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('@/workspace/file.ts#L3-7');
  });

  it('should use absolute path when no workspace', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: 'C:\\foo\\bar.ts',
      startLine: 0,
      endLine: 0,
      isEmpty: true,
    });

    await copyReference();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('@C:/foo/bar.ts');
  });

  it('should normalize backslashes to forward slashes', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: 'C:\\Users\\dev\\project\\src\\index.ts',
      startLine: 0,
      endLine: 0,
      isEmpty: true,
    });

    await copyReference();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('@C:/Users/dev/project/src/index.ts');
  });

  it('should not send to terminal when isClaudeTerminal returns false', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: '/workspace/file.ts',
      startLine: 0,
      endLine: 0,
      isEmpty: true,
    });
    (vscode.window as any).activeTerminal = { processId: Promise.resolve(1234) };
    mockedIsClaudeTerminal.mockResolvedValue(false);

    await copyReference();

    expect(mockedSendToTerminal).not.toHaveBeenCalled();
  });

  it('should send to terminal when isClaudeTerminal returns true', async () => {
    (vscode.window as any).activeTextEditor = createMockEditor({
      filePath: '/workspace/file.ts',
      startLine: 0,
      endLine: 0,
      isEmpty: true,
    });
    (vscode.window as any).activeTerminal = { processId: Promise.resolve(1234) };
    mockedIsClaudeTerminal.mockResolvedValue(true);

    await copyReference();

    expect(mockedSendToTerminal).toHaveBeenCalledWith('@/workspace/file.ts', { appendSpace: true });
  });

  it('should do nothing when no active editor', async () => {
    (vscode.window as any).activeTextEditor = undefined;

    await copyReference();

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    expect(mockedSendToTerminal).not.toHaveBeenCalled();
  });
});

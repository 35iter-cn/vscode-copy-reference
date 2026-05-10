import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { WslClipboardReader } from './wsl-reader';
import { MacOSClipboardReader } from './macos-reader';
import { WindowsClipboardReader } from './windows-reader';

export interface ClipboardReader {
  read(outputChannel: vscode.OutputChannel): Promise<string>;
}

export interface ClipboardImageResult {
  buffer: Buffer;
  path: string;
}

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

export async function readClipboardImage(outputChannel: vscode.OutputChannel): Promise<ClipboardImageResult> {
  const reader = createClipboardReader();
  const base64 = await reader.read(outputChannel);
  const buffer = Buffer.from(base64, 'base64');

  const tempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(tempFile, buffer);
  outputChannel.appendLine(`[pasteImage] Image saved to ${tempFile} (${buffer.length} bytes)`);

  return { buffer, path: tempFile };
}

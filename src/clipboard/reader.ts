import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

function execPromise(command: string): Promise<{ stdout: Buffer; stderr: Buffer; error?: Error }> {
  return new Promise((resolve) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error || undefined });
    });
  });
}

export interface ClipboardImageResult {
  buffer: Buffer;
  path: string;
}

export async function readClipboardImage(outputChannel: vscode.OutputChannel): Promise<ClipboardImageResult> {
  outputChannel.appendLine('[pasteImage] Starting clipboard image read...');

  const psScript = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $stream = New-Object System.IO.MemoryStream
  $img.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  Write-Output "OK:$([Convert]::ToBase64String($bytes))"
} else {
  Write-Output "NO_IMAGE"
}`;

  const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

  const { stdout, stderr, error } = await execPromise(
    `powershell.exe -NoLogo -NonInteractive -EncodedCommand ${encodedCommand}`
  );
  if (error) {
    outputChannel.appendLine(`[pasteImage] exec error: ${error.message}`);
  }

  const output = stdout.toString('utf8');
  outputChannel.appendLine(`[pasteImage] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
  if (stderr.length > 0) {
    outputChannel.appendLine(`[pasteImage] stderr: ${stderr.toString('utf8').slice(0, 500)}`);
  }

  const okMatch = output.match(/OK:([A-Za-z0-9+/=]+)/);
  const noImage = output.includes('NO_IMAGE');

  if (noImage) {
    throw new Error('No image in clipboard');
  }

  if (!okMatch) {
    outputChannel.appendLine(`[pasteImage] stdout text: ${output.slice(0, 300)}`);
    throw new Error('Unexpected PowerShell output (see Output panel for full details)');
  }

  const base64 = okMatch[1];
  const buffer = Buffer.from(base64, 'base64');

  const wslTempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(wslTempFile, buffer);
  outputChannel.appendLine(`[pasteImage] Image saved to ${wslTempFile} (${buffer.length} bytes)`);

  return { buffer, path: wslTempFile };
}

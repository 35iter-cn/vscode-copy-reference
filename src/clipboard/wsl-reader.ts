import { exec } from 'child_process';
import * as vscode from 'vscode';

function execPromise(command: string): Promise<{ stdout: Buffer; stderr: Buffer; error?: Error }> {
  return new Promise((resolve) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error || undefined });
    });
  });
}

export class WslClipboardReader {
  async read(outputChannel: vscode.OutputChannel): Promise<string> {
    outputChannel.appendLine('[pasteImage] Starting clipboard image read (WSL)...');

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

    return okMatch[1];
  }
}

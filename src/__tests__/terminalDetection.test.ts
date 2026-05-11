import * as os from 'os';
import { exec } from 'child_process';
import { getProcessName, getChildProcessNames, isClaudeTerminal } from '../commands/terminalDetection';

jest.mock('os');
jest.mock('child_process');

const mockedOs = os as jest.Mocked<typeof os>;
const mockedExec = exec as jest.MockedFunction<typeof exec>;

describe('getProcessName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return process name on Linux', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude\n', '');
      }
      return {} as any;
    });

    const result = await getProcessName(1234);

    expect(result).toBe('claude');
    expect(mockedExec).toHaveBeenCalledWith('ps -p 1234 -o comm=', { encoding: 'utf8' }, expect.any(Function));
  });

  it('should return process name on macOS', async () => {
    mockedOs.platform.mockReturnValue('darwin');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude\n', '');
      }
      return {} as any;
    });

    const result = await getProcessName(1234);

    expect(result).toBe('claude');
    expect(mockedExec).toHaveBeenCalledWith('ps -p 1234 -o comm=', { encoding: 'utf8' }, expect.any(Function));
  });

  it('should return process name on Windows', async () => {
    mockedOs.platform.mockReturnValue('win32');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude.exe\n', '');
      }
      return {} as any;
    });

    const result = await getProcessName(1234);

    expect(result).toBe('claude.exe');
    expect(mockedExec).toHaveBeenCalledWith(
      `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=1234' | Select-Object -ExpandProperty Name"`,
      { encoding: 'utf8' },
      expect.any(Function)
    );
  });

  it('should return null on error', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('process not found'), '', '');
      }
      return {} as any;
    });

    const result = await getProcessName(1234);

    expect(result).toBeNull();
  });
});

describe('getChildProcessNames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return child process names on Linux', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'bash\nclaude\n', '');
      }
      return {} as any;
    });

    const result = await getChildProcessNames(1234);

    expect(result).toEqual(['bash', 'claude']);
    expect(mockedExec).toHaveBeenCalledWith('ps --ppid 1234 -o comm=', { encoding: 'utf8' }, expect.any(Function));
  });

  it('should return child process names on macOS using pgrep', async () => {
    mockedOs.platform.mockReturnValue('darwin');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, '2345 claude\n2346 node\n', '');
      }
      return {} as any;
    });

    const result = await getChildProcessNames(1234);

    expect(result).toEqual(['claude', 'node']);
    expect(mockedExec).toHaveBeenCalledWith('pgrep -P 1234 -l', { encoding: 'utf8' }, expect.any(Function));
  });

  it('should return child process names on Windows', async () => {
    mockedOs.platform.mockReturnValue('win32');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude.exe\nnode.exe\n', '');
      }
      return {} as any;
    });

    const result = await getChildProcessNames(1234);

    expect(result).toEqual(['claude.exe', 'node.exe']);
  });

  it('should return empty array on error', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('no children'), '', '');
      }
      return {} as any;
    });

    const result = await getChildProcessNames(1234);

    expect(result).toEqual([]);
  });
});

describe('isClaudeTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when terminal process itself is claude on Linux', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude\n', '');
      }
      return {} as any;
    });

    const terminal = { processId: Promise.resolve(1234) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(true);
  });

  it('should return true when child process is claude on Linux', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        if (command.includes('ps -p')) {
          callback(null, 'bash\n', '');
        } else if (command.includes('--ppid')) {
          callback(null, 'claude\n', '');
        }
      }
      return {} as any;
    });

    const terminal = { processId: Promise.resolve(1234) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(true);
  });

  it('should use pgrep on macOS', async () => {
    mockedOs.platform.mockReturnValue('darwin');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude\n', '');
      }
      return {} as any;
    });

    const terminal = { processId: Promise.resolve(1234) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(true);
    expect(mockedExec).toHaveBeenCalledWith('ps -p 1234 -o comm=', { encoding: 'utf8' }, expect.any(Function));
  });

  it('should use powershell on Windows', async () => {
    mockedOs.platform.mockReturnValue('win32');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'claude.exe\n', '');
      }
      return {} as any;
    });

    const terminal = { processId: Promise.resolve(1234) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(true);
    expect(mockedExec).toHaveBeenCalledWith(
      expect.stringContaining('powershell.exe'),
      { encoding: 'utf8' },
      expect.any(Function)
    );
  });

  it('should return false when no pid', async () => {
    const terminal = { processId: Promise.resolve(undefined) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockedOs.platform.mockReturnValue('linux');
    mockedExec.mockImplementation((command, options, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('ps failed'), '', '');
      }
      return {} as any;
    });

    const terminal = { processId: Promise.resolve(1234) } as unknown as import('vscode').Terminal;
    const result = await isClaudeTerminal(terminal);

    expect(result).toBe(false);
  });
});

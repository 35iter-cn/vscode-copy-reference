export const window = {
  activeTextEditor: undefined as any,
  activeTerminal: undefined as any,
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
  },
};

export const commands = {
  executeCommand: jest.fn(),
};

export class Terminal {
  constructor(public name: string, public processId: number | undefined) {}
  sendText = jest.fn();
}

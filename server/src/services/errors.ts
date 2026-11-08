import os from "node:os";

export function redactLocalPaths(input: string): string {
  let result = input;
  const home = os.homedir();
  if (home) {
    const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escapedHome, "gi"), "~");
    const slashHome = home.replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(slashHome, "gi"), "~");
  }
  return result;
}

export class BridgeError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "BridgeError";
    this.hint = hint;
  }

  toAgentMessage(): string {
    if (this.hint) {
      return redactLocalPaths(`Error: ${this.message}. ${this.hint}`);
    }
    return redactLocalPaths(`Error: ${this.message}`);
  }
}

export function toAgentError(error: unknown): string {
  if (error instanceof BridgeError) {
    return error.toAgentMessage();
  }
  if (error instanceof Error) {
    return redactLocalPaths(`Error: ${error.message}`);
  }
  return redactLocalPaths(`Error: Unexpected failure: ${String(error)}`);
}

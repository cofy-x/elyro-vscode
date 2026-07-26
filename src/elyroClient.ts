import { spawn } from "node:child_process";

export interface CancellationLike {
  isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface JsonCommandResult<T> extends CommandResult {
  data: T;
}

export class ElyroCommandError extends Error {
  constructor(
    message: string,
    readonly result?: CommandResult,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ElyroCommandError";
  }
}

export class ElyroCancellationError extends ElyroCommandError {
  constructor(result?: CommandResult) {
    super("Elyro command was cancelled.", result);
    this.name = "ElyroCancellationError";
  }
}

export class ElyroClient {
  constructor(
    readonly executable: string,
    private readonly log: (line: string) => void,
  ) {}

  async run(
    args: readonly string[],
    cwd: string,
    cancellation?: CancellationLike,
  ): Promise<CommandResult> {
    this.log(`$ ${formatCommand(this.executable, args)}`);

    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(this.executable, args, {
        cwd,
        env: process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

      const subscription = cancellation?.onCancellationRequested(() => {
        child.kill("SIGTERM");
      });

      child.on("error", (error) => {
        subscription?.dispose();
        reject(
          new ElyroCommandError(
            errorCode(error) === "ENOENT"
              ? `Cannot find the Elyro executable: ${this.executable}`
              : `Unable to start Elyro: ${error.message}`,
            undefined,
            error,
          ),
        );
      });

      child.on("close", (code, signal) => {
        subscription?.dispose();
        const result = {
          stdout: Buffer.concat(stdout).toString("utf8").trim(),
          stderr: Buffer.concat(stderr).toString("utf8").trim(),
          exitCode: code ?? (signal === null ? 1 : 130),
        };
        logResult(result, this.log);

        if (cancellation?.isCancellationRequested) {
          reject(new ElyroCancellationError(result));
          return;
        }
        resolve(result);
      });
    });
  }

  async runJson<T>(
    args: readonly string[],
    cwd: string,
    validate: (value: unknown) => value is T,
    cancellation?: CancellationLike,
  ): Promise<JsonCommandResult<T>> {
    const result = await this.run(args, cwd, cancellation);
    if (result.stdout.length === 0) {
      throw new ElyroCommandError(commandFailureMessage(result), result);
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(result.stdout);
    } catch (error) {
      throw new ElyroCommandError(
        "Elyro returned invalid JSON.",
        result,
        error,
      );
    }
    if (!validate(decoded)) {
      throw new ElyroCommandError(
        "Elyro returned an unsupported JSON schema.",
        result,
      );
    }
    return { ...result, data: decoded };
  }
}

export function commandFailureMessage(result: CommandResult): string {
  const detail = result.stderr || result.stdout;
  return detail.length > 0
    ? detail.split("\n")[0]!
    : `Elyro exited with code ${result.exitCode}.`;
}

function logResult(result: CommandResult, log: (line: string) => void): void {
  if (result.stdout) {
    log(result.stdout);
  }
  if (result.stderr) {
    log(result.stderr);
  }
  log(`[exit ${result.exitCode}]`);
}

function formatCommand(executable: string, args: readonly string[]): string {
  return [executable, ...args].map(quoteForDisplay).join(" ");
}

function quoteForDisplay(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

function errorCode(error: Error): string | undefined {
  return "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

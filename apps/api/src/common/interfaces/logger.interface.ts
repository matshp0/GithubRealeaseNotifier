interface LogFn {
  (obj: object, msg?: string): void;
  (msg: string): void;
}

export interface ILogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

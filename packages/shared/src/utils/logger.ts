export type OperationalErrorKind =
  | "user_expected"
  | "connectivity"
  | "authorization"
  | "integration_failure"
  | "security_event"
  | "offline_recoverable"
  | "unexpected_exception";

export type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export interface StructuredLogEntry {
  event: string;
  level: LogLevel;
  scope?: string;
  kind?: OperationalErrorKind;
  timestamp: string;
  context: LogContext;
}

export interface Logger {
  info(event: string, context?: LogContext, kind?: OperationalErrorKind): void;
  warn(event: string, context?: LogContext, kind?: OperationalErrorKind): void;
  error(event: string, context?: LogContext, kind?: OperationalErrorKind): void;
}

const SENSITIVE_KEY_PATTERN =
  /(^|_|\b)(password|token|secret|authorization|cookie|dataurl|base64|archivo|file|contenido|documento|signedurl|urltemporal|publicurl|local_path|path|ruta|vin)(_|$|\b)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorCode(error: unknown): string {
  if (isRecord(error)) {
    const code = error.code ?? error.status ?? error.name;
    if (typeof code === "string" && code.trim()) return code;
    if (typeof code === "number") return String(code);
  }

  if (error instanceof Error && error.name) return error.name;
  return "unknown_error";
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value instanceof Error) {
    return {
      name: value.name,
      code: errorCode(value)
    };
  }
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(nested, depth + 1)
    ])
  );
}

export function sanitizeLogContext(context: LogContext = {}): LogContext {
  return sanitizeValue(context) as LogContext;
}

export function createLogger(scope?: string): Logger {
  function write(level: LogLevel, event: string, context: LogContext = {}, kind?: OperationalErrorKind) {
    const entry: StructuredLogEntry = {
      event,
      level,
      ...(scope ? { scope } : {}),
      ...(kind ? { kind } : {}),
      timestamp: new Date().toISOString(),
      context: sanitizeLogContext(context)
    };

    if (level === "error") {
      console.error(entry);
    } else if (level === "warn") {
      console.warn(entry);
    } else {
      console.info(entry);
    }
  }

  return {
    info: (event, context, kind) => write("info", event, context, kind),
    warn: (event, context, kind) => write("warn", event, context, kind),
    error: (event, context, kind) => write("error", event, context, kind)
  };
}

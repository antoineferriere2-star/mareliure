const SENSITIVE_KEY = /(authorization|api[_-]?key|base64|email|image|password|secret|token)/i;
const MAX_STRING_LENGTH = 240;
const MAX_DEPTH = 4;

export type OperationalMetadata = Record<string, unknown>;

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
}

function serializeError(error: unknown): OperationalMetadata {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncate(error.message),
    };
  }
  if (typeof error === "string") return { message: truncate(error) };
  return { value: sanitizeOperationalMetadata(error) };
}

export function sanitizeOperationalMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value);
  if (typeof value !== "object") return value;
  if (value instanceof Error) return serializeError(value);
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeOperationalMetadata(item, depth + 1));
  }

  const output: OperationalMetadata = {};
  for (const [key, nested] of Object.entries(value as OperationalMetadata)) {
    output[key] = SENSITIVE_KEY.test(key)
      ? "[redacted]"
      : sanitizeOperationalMetadata(nested, depth + 1);
  }
  return output;
}

export function logOperationalError(
  event: string,
  error: unknown,
  metadata: OperationalMetadata = {},
) {
  console.error(`[metre-build] ${event}`, {
    error: serializeError(error),
    metadata: sanitizeOperationalMetadata(metadata),
  });
}

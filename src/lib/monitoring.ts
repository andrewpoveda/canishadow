import * as Sentry from "@sentry/nextjs";

interface OperationalErrorOptions {
  operation: string;
  message: string;
}

const SAFE_TAG_VALUE = /^[a-z0-9_.:-]{1,64}$/i;

function safeTagValue(value: unknown) {
  return typeof value === "string" && SAFE_TAG_VALUE.test(value)
    ? value
    : undefined;
}

// Handled service/database errors can contain request or rejected-row details.
// Report the failing operation without forwarding that original exception data.
export function captureOperationalError(
  error: unknown,
  { operation, message }: OperationalErrorOptions,
) {
  const tags: Record<string, string> = { operation };

  try {
    if (error instanceof Error) {
      const errorName = safeTagValue(error.name);
      if (errorName) tags.error_name = errorName;
    }

    if (error && typeof error === "object" && "code" in error) {
      const errorCode = safeTagValue((error as { code?: unknown }).code);
      if (errorCode) tags.error_code = errorCode;
    }
  } catch {
    // Error metadata is optional; monitoring must never alter the fallback path.
  }

  Sentry.captureException(new Error(message), { tags });
}

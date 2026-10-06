import type { ErrorEvent } from "@sentry/nextjs";

// CANISHADOW-4: an injected Deno runtime reported a getReader rejection as a
// browser error. Match its full signature, never the message alone: real React
// streaming failures can have the same message and must remain visible.
export function filterBrowserError(event: ErrorEvent): ErrorEvent | null {
  const exceptions = event.exception?.values;
  if (exceptions?.length !== 1) return event;

  const exception = exceptions[0];
  const frames = exception.stacktrace?.frames ?? [];
  const isInjectedRuntimeError =
    exception.type === "TypeError" &&
    exception.value === "Cannot read properties of undefined (reading 'getReader')" &&
    exception.mechanism?.type === "auto.browser.global_handlers.onunhandledrejection" &&
    exception.mechanism.handled === false &&
    frames.some((frame) => frame.filename === "ext:core/01_core.js") &&
    frames.some((frame) => frame.filename === "<script>") &&
    frames.every((frame) =>
      frame.filename === "<script>" || frame.filename === "ext:core/01_core.js",
    );

  return isInjectedRuntimeError ? null : event;
}

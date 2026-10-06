import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";
import { filterBrowserError } from "./sentry-browser-filter";

function reportedEvent(): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [{
        type: "TypeError",
        value: "Cannot read properties of undefined (reading 'getReader')",
        mechanism: { type: "auto.browser.global_handlers.onunhandledrejection", handled: false },
        stacktrace: { frames: [
          { filename: "ext:core/01_core.js", function: "eventLoopTick", lineno: 178 },
          { filename: "ext:core/01_core.js", lineno: 294 },
          { filename: "<script>", lineno: 1, colno: 100633 },
          { filename: "<script>", function: "xm", lineno: 1, colno: 98865 },
          { filename: "<script>", lineno: 2, colno: 21171 },
          { filename: "<script>", function: "I", lineno: 2, colno: 17726 },
        ] },
      }],
    },
  };
}

test("drops the CANISHADOW-4 injected runtime signature", () => {
  assert.equal(filterBrowserError(reportedEvent()), null);
});

test("keeps real application streaming failures, including mixed stacks", () => {
  for (const mixed of [false, true]) {
    const event = reportedEvent();
    const frames = event.exception!.values![0].stacktrace!.frames!;
    if (!mixed) frames.length = 0;
    frames.push({ filename: "https://www.canishadow.com/_next/static/chunks/app.js" });
    assert.equal(filterBrowserError(event), event);
  }
});

test("keeps incomplete evidence, other errors, and chained exceptions", () => {
  const variants = Array.from({ length: 7 }, reportedEvent);
  variants[0].exception!.values![0].stacktrace = undefined;
  variants[1].exception!.values![0].stacktrace!.frames = [{ filename: "<script>" }];
  variants[2].exception!.values![0].value = "Another error";
  variants[3].exception!.values![0].mechanism = undefined;
  variants[4].exception!.values![0].mechanism!.handled = true;
  variants[5].exception!.values!.push({ type: "Error", value: "Application failure" });
  variants[6].exception!.values![0].stacktrace!.frames!.push({});
  for (const event of [{ type: undefined }, ...variants]) {
    assert.equal(filterBrowserError(event), event);
  }
});

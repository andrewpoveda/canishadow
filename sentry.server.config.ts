// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://68a5e4ae90b5d64015aca171f23b9b09@o4511567389786112.ingest.us.sentry.io/4512082102059008",

  // Keep local diagnostics complete while limiting production tracing volume.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  // Call logs may contain names, contact details, and notes. Keep request data
  // and local values out of error events while retaining stacks and tracing.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
  },
});

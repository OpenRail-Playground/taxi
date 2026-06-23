/**
 * Build-time constant injected via the Angular builder's esbuild `define`
 * (see angular.json `architect.build.options.define`).
 *
 * Default value is `"http://localhost:3000"` for local dev. Production
 * builds override it with `ng build --define BACKEND_URL="\"https://...\""`,
 * which the deploy pipeline drives from the BACKEND_URL env var.
 */
declare const BACKEND_URL: string;

export const environment = {
  backendUrl: BACKEND_URL,
};

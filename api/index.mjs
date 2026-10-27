// Vercel invokes the Express app per request; the standalone server keeps its
// own listening entry point for local development and Replit.
export { default } from '../artifacts/api-server/dist/app.mjs';

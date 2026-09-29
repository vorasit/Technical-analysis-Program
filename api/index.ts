// Vercel Function entrypoint: every /api/* request is rewritten here (see
// vercel.json) and handled by the same Express app the local dev server runs.
import app from "../server/src/app.js";

export default app;

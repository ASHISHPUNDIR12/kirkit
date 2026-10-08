import { teamRouter } from "./routes/teamRoutes.js";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { randomUUID } from "node:crypto";
import { env } from "./utils/env.js";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { healthRouter } from "./routes/healthRoutes.js";
import { matchRouter } from "./routes/matchRoutes.js";
import { inningsRouter } from "./routes/inningsRoutes.js";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use((request, response, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  response.on("finish", () => {
    if (process.env.NODE_ENV !== "test")
      console.log(
        JSON.stringify({
          requestId,
          method: request.method,
          status: response.statusCode,
          durationMs: Math.round(performance.now() - started),
        }),
      );
  });
  if (app.locals.shuttingDown) {
    response.setHeader("Connection", "close");
    response.status(503).json({ error: "Server is shutting down." });
    return;
  }
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      callback(
        null,
        !origin ||
          (!env.production && env.corsOrigins.length === 0) ||
          env.corsOrigins.includes(origin),
      );
    },
  }),
);
app.get("/live", (_request, response) => {
  response.json({ status: "ok" });
});
app.use(express.json({ limit: "16kb" }));
app.use(healthRouter);
app.use("/auth", authRouter);
if (env.legacyScoringEnabled) {
  app.use("/teams", requireAuth, teamRouter);
  app.use("/matches", requireAuth, matchRouter);
  app.use("/innings", requireAuth, inningsRouter);
} else {
  app.use(["/teams", "/matches", "/innings"], requireAuth, (_request, response) => {
    response.status(410).json({ error: "Cloud scoring is retired. Matches are saved on this device." });
  });
}

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
  if (response.headersSent) {
    _next(error);
    return;
  }
  if (error?.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must be valid JSON." });
  } else if (error?.type === "entity.too.large") {
    response.status(413).json({ error: "Request body is too large." });
  } else {
    console.error("Unexpected API request error.");
    response
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
};
app.use(handleError);

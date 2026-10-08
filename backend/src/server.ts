import { app } from "./app.js";
import { checkDatabaseConnection, prisma } from "./services/database.js";
import { env } from "./utils/env.js";
import { startupErrorMessage } from "./utils/startupError.js";

async function startServer() {
  await checkDatabaseConnection();
  console.log("PostgreSQL connection verified.");

  const server = app.listen(env.port, "0.0.0.0");
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.on("listening", () =>
    console.log(`Backend listening on port ${env.port}.`),
  );
  let stopping = false;
  const shutdown = (exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    app.locals.shuttingDown = true;
    console.log("Backend shutting down.");
    const deadline = setTimeout(() => {
      console.error("Shutdown deadline exceeded.");
      server.closeAllConnections();
      process.exit(1);
    }, env.shutdownTimeoutMs);
    deadline.unref();
    server.close(() => {
      void prisma.$disconnect().then(
        () => {
          clearTimeout(deadline);
          process.exit(exitCode);
        },
        () => {
          console.error("Database disconnect failed.");
          process.exit(1);
        },
      );
    });
  };
  server.on("error", (error) => {
    console.error(startupErrorMessage(error));
    shutdown(1);
  });
  process.once("SIGINT", () => shutdown());
  process.once("SIGTERM", () => shutdown());
}

startServer().catch((error) => {
  console.error(startupErrorMessage(error));
  const deadline = setTimeout(() => process.exit(1), env.shutdownTimeoutMs);
  deadline.unref();
  void prisma.$disconnect().then(() => process.exit(1), () => process.exit(1));
});

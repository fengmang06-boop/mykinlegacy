import { createWorkerApp } from "./app";
import { loadWorkerConfig } from "./config";

const app = createWorkerApp({
  config: loadWorkerConfig()
});

process.once("SIGINT", () => {
  void app.shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void app.shutdown().then(() => process.exit(0));
});

void app.start();

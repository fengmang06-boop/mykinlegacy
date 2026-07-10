import path from "node:path";

const blockedDatabaseSchemes = ["mysql:", "postgres:", "postgresql:", "mongodb:", "redis:"];

export function assertEtsyDatabaseIsolation(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db"): void {
  const normalized = databaseUrl.trim();
  const lower = normalized.toLowerCase();

  if (blockedDatabaseSchemes.some((scheme) => lower.startsWith(scheme))) {
    throw new Error("MENSSKULL Etsy AI Manager database isolation violation: DATABASE_URL must be local SQLite.");
  }
  if (!lower.startsWith("file:")) {
    throw new Error("MENSSKULL Etsy AI Manager database isolation violation: DATABASE_URL must use file: SQLite.");
  }

  const dbPath = normalized.slice("file:".length).replace(/^['"]|['"]$/g, "");
  const appRoot = process.cwd();
  const resolved = path.resolve(appRoot, dbPath.startsWith("./") ? path.join("prisma", dbPath.slice(2)) : dbPath);
  const allowedRoots = [path.resolve(appRoot), path.resolve(appRoot, "prisma")];
  const insideApp = allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));

  if (!insideApp || !resolved.endsWith(".db")) {
    throw new Error("MENSSKULL Etsy AI Manager database isolation violation: SQLite database must stay inside the app directory.");
  }
}

import { join } from "path";

export function getDatabasePath(): string {
  const configuredPath = process.env.MARCH_MADNESS_DB_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  return join(process.cwd(), "march-madness.db");
}

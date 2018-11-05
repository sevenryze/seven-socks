import debug from "debug";
import path from "path";

export function Debug(filename: string) {
  return debug(`tiny-socks:${path.basename(filename, ".js")} -> `);
}

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "web");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "studio"), { recursive: true });
await cp(source, resolve(output, "studio"), { recursive: true });

const hostedIndexPath = resolve(output, "studio", "index.html");
const hostedIndex = await readFile(hostedIndexPath, "utf8");
await writeFile(
  hostedIndexPath,
  hostedIndex.replace(
    '<meta name="game-guide-studio-api-origin" content="">',
    '<meta name="game-guide-studio-api-origin" content="http://127.0.0.1:8770">',
  ),
  "utf8",
);

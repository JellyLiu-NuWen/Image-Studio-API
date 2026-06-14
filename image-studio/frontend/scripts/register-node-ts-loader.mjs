import { register } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

register("./node-ts-loader.mjs", pathToFileURL(`${scriptsDir}/`));

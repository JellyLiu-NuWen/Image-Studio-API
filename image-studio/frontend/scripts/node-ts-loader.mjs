import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const LOADERS = new Map([
  [".ts", "ts"],
  [".tsx", "tsx"],
]);

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:")) {
    const extension = extname(fileURLToPath(url));
    const loader = LOADERS.get(extension);
    if (loader) {
      const source = await readFile(fileURLToPath(url), "utf8");
      const result = ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          jsx: loader === "tsx" ? ts.JsxEmit.ReactJSX : undefined,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
          target: ts.ScriptTarget.ES2022,
        },
      });
      return {
        format: "module",
        shortCircuit: true,
        source: result.outputText,
      };
    }
  }
  return nextLoad(url, context);
}

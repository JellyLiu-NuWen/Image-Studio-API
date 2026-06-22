import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function cloneJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createJsonStateStore({ path, fallback }) {
  const defaultValue = cloneJSON(fallback);
  let pendingSave = Promise.resolve();

  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return cloneJSON(defaultValue);
        throw error;
      }
    },
    async save(value) {
      const snapshot = cloneJSON(value);
      const write = pendingSave.catch(() => undefined).then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      });
      pendingSave = write;
      await write;
      return cloneJSON(snapshot);
    },
  };
}

export function createMemoryStateStore(initialValue) {
  let value = cloneJSON(initialValue);

  return {
    async load() {
      return cloneJSON(value);
    },
    async save(nextValue) {
      value = cloneJSON(nextValue);
      return cloneJSON(value);
    },
  };
}

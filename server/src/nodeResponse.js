import { Readable } from "node:stream";

export async function writeWebResponse(nodeResponse, webResponse) {
  nodeResponse.statusCode = webResponse.status;
  for (const [key, value] of webResponse.headers) {
    nodeResponse.setHeader(key, value);
  }
  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }
  if ((webResponse.headers.get("content-type") || "").toLowerCase().includes("text/event-stream")) {
    nodeResponse.socket?.setTimeout?.(0);
    nodeResponse.socket?.setKeepAlive?.(true, 10_000);
    nodeResponse.flushHeaders?.();
    Readable.fromWeb(webResponse.body).pipe(nodeResponse);
    return;
  }
  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeResponse.end(body);
}

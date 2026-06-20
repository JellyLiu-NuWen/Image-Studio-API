import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { writeWebResponse } from "../src/nodeResponse.js";

class CapturingNodeResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 0;
    this.headers = {};
    this.flushCount = 0;
    this.writeCountAtFlush = null;
    this.chunks = [];
    this.socketTimeout = null;
    this.socketKeepAlive = null;
    this.socket = {
      setTimeout: (value) => {
        this.socketTimeout = value;
      },
      setKeepAlive: (enabled, initialDelay) => {
        this.socketKeepAlive = { enabled, initialDelay };
      },
    };
  }

  setHeader(key, value) {
    this.headers[key.toLowerCase()] = value;
  }

  flushHeaders() {
    this.flushCount += 1;
    this.writeCountAtFlush = this.chunks.length;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

test("SSE responses flush headers before streaming chunks", async () => {
  const nodeResponse = new CapturingNodeResponse();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": image-studio keepalive\n\n"));
      controller.close();
    },
  });
  const webResponse = new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });

  await writeWebResponse(nodeResponse, webResponse);
  await new Promise((resolve) => nodeResponse.once("finish", resolve));

  assert.equal(nodeResponse.statusCode, 200);
  assert.equal(nodeResponse.flushCount, 1);
  assert.equal(nodeResponse.writeCountAtFlush, 0);
  assert.equal(Buffer.concat(nodeResponse.chunks).toString("utf8"), ": image-studio keepalive\n\n");
});

test("SSE responses disable socket idle timeout and enable TCP keepalive", async () => {
  const nodeResponse = new CapturingNodeResponse();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": image-studio keepalive\n\n"));
      controller.close();
    },
  });
  const webResponse = new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
    },
  });

  await writeWebResponse(nodeResponse, webResponse);
  await new Promise((resolve) => nodeResponse.once("finish", resolve));

  assert.equal(nodeResponse.socketTimeout, 0);
  assert.deepEqual(nodeResponse.socketKeepAlive, { enabled: true, initialDelay: 10_000 });
});

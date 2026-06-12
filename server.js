const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const OLLAMA_HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/+$/, "");
const ROOT = __dirname;
const BODY_LIMIT = 20 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) {
      throw new Error("요청 본문이 너무 큽니다.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function ollamaJson(endpoint, payload, signal) {
  const response = await fetch(`${OLLAMA_HOST}${endpoint}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    throw new Error(data.error || `${response.status} ${response.statusText}`);
  }

  return data;
}

async function handleHealth(_req, res) {
  try {
    const data = await ollamaJson("/api/tags");
    const models = Array.isArray(data.models)
      ? data.models.map((model) => model.name).filter(Boolean)
      : [];
    sendJson(res, 200, { ok: true, host: OLLAMA_HOST, models });
  } catch (error) {
    sendJson(res, 503, {
      ok: false,
      host: OLLAMA_HOST,
      error: `Ollama 연결 실패: ${error.message}`,
    });
  }
}

async function handleTranslate(req, res) {
  try {
    const controller = new AbortController();
    req.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const body = await readJsonBody(req);
    const model = String(body.model || "").trim();
    const system = String(body.system || "").trim();
    const prompt = String(body.prompt || "").trim();
    const temperature = Number(body.temperature);

    if (!model) {
      sendJson(res, 400, { ok: false, error: "모델명이 비어 있습니다." });
      return;
    }

    if (!prompt) {
      sendJson(res, 400, { ok: false, error: "번역할 원문이 비어 있습니다." });
      return;
    }

    const data = await ollamaJson(
      "/api/generate",
      {
        model,
        system,
        prompt,
        stream: false,
        think: false,
        options: {
          temperature: Number.isFinite(temperature) ? temperature : 0.2,
          top_p: 0.9,
        },
        keep_alive: "10m",
      },
      controller.signal,
    );

    sendJson(res, 200, { ok: true, response: data.response || "" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "번역 실패" });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const requestedPath = path.resolve(ROOT, relativePath);

  if (!requestedPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(requestedPath);
    const ext = path.extname(requestedPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/api/health")) {
    handleHealth(req, res);
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/api/translate")) {
    handleTranslate(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Local Light Novel Translator: http://localhost:${PORT}`);
  console.log(`Ollama host: ${OLLAMA_HOST}`);
});

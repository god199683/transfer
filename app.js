const STORAGE_KEY = "open-source-long-translator-settings";

const DEFAULT_SETTINGS = {
  endpoint: "https://libretranslate.com",
  apiKey: "",
  sourceLang: "ja",
  route: "pivot",
  chunkSize: 1600,
  requestSize: 3000,
  delay: 700,
  glossary: "",
};

const els = {
  endpointInput: document.querySelector("#endpointInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  sourceLangInput: document.querySelector("#sourceLangInput"),
  routeInput: document.querySelector("#routeInput"),
  chunkSizeInput: document.querySelector("#chunkSizeInput"),
  requestSizeInput: document.querySelector("#requestSizeInput"),
  delayInput: document.querySelector("#delayInput"),
  glossaryInput: document.querySelector("#glossaryInput"),
  checkButton: document.querySelector("#checkButton"),
  languageText: document.querySelector("#languageText"),
  sourceText: document.querySelector("#sourceText"),
  koreanText: document.querySelector("#koreanText"),
  sourceCount: document.querySelector("#sourceCount"),
  koreanCount: document.querySelector("#koreanCount"),
  chunkText: document.querySelector("#chunkText"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  stageText: document.querySelector("#stageText"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  translateButton: document.querySelector("#translateButton"),
  cancelButton: document.querySelector("#cancelButton"),
  clearButton: document.querySelector("#clearButton"),
  copyButton: document.querySelector("#copyButton"),
  downloadButton: document.querySelector("#downloadButton"),
  loadButton: document.querySelector("#loadButton"),
  normalizeButton: document.querySelector("#normalizeButton"),
  fileInput: document.querySelector("#fileInput"),
  logList: document.querySelector("#logList"),
};

const state = {
  settings: loadSettings(),
  abortController: null,
  running: false,
  translatedUnits: 0,
  totalUnits: 0,
};

hydrateSettings();
bindEvents();
updateCounts();
setStatus("idle", "대기");

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  const next = readSettings();
  state.settings = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function hydrateSettings() {
  els.endpointInput.value = state.settings.endpoint;
  els.apiKeyInput.value = state.settings.apiKey;
  els.sourceLangInput.value = state.settings.sourceLang;
  els.routeInput.value = state.settings.route;
  els.chunkSizeInput.value = String(state.settings.chunkSize);
  els.requestSizeInput.value = String(state.settings.requestSize);
  els.delayInput.value = String(state.settings.delay);
  els.glossaryInput.value = state.settings.glossary;
}

function readSettings() {
  return {
    endpoint: normalizeEndpoint(els.endpointInput.value || DEFAULT_SETTINGS.endpoint),
    apiKey: els.apiKeyInput.value.trim(),
    sourceLang: els.sourceLangInput.value,
    route: els.routeInput.value,
    chunkSize: clampNumber(els.chunkSizeInput.value, 300, 5000, DEFAULT_SETTINGS.chunkSize),
    requestSize: clampNumber(els.requestSizeInput.value, 500, 8000, DEFAULT_SETTINGS.requestSize),
    delay: clampNumber(els.delayInput.value, 0, 5000, DEFAULT_SETTINGS.delay),
    glossary: els.glossaryInput.value,
  };
}

function bindEvents() {
  [
    els.endpointInput,
    els.apiKeyInput,
    els.sourceLangInput,
    els.routeInput,
    els.chunkSizeInput,
    els.requestSizeInput,
    els.delayInput,
    els.glossaryInput,
  ].forEach((el) => el.addEventListener("change", saveSettings));

  els.checkButton.addEventListener("click", checkEndpoint);
  els.translateButton.addEventListener("click", translateSource);
  els.cancelButton.addEventListener("click", cancelTranslation);
  els.clearButton.addEventListener("click", clearSource);
  els.copyButton.addEventListener("click", copyOutput);
  els.downloadButton.addEventListener("click", downloadOutput);
  els.loadButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", loadTextFile);
  els.normalizeButton.addEventListener("click", normalizeSourceText);
  els.sourceText.addEventListener("input", updateCounts);
  els.koreanText.addEventListener("input", updateCounts);
  els.sourceText.addEventListener("paste", normalizePaste);
}

async function checkEndpoint() {
  const settings = readSettings();
  saveSettings();
  setStatus("busy", "확인 중");
  els.languageText.textContent = "확인 중";

  try {
    const languages = await fetchJson(settings, "/languages", { method: "GET" });
    const codes = Array.isArray(languages) ? languages.map((lang) => lang.code).filter(Boolean) : [];
    const hasJa = codes.includes("ja");
    const hasEn = codes.includes("en");
    const hasKo = codes.includes("ko");
    const ok = hasJa && hasEn && hasKo;

    els.languageText.textContent = ok
      ? `지원 확인: ja, en, ko / ${codes.length}개 언어`
      : `확인 필요: ${codes.slice(0, 12).join(", ") || "언어 목록 없음"}`;
    setStatus(ok ? "ok" : "error", ok ? "연결됨" : "언어 확인");
    log(ok ? "API 연결과 언어 목록을 확인했습니다." : "필요 언어가 목록에 없을 수 있습니다.", ok ? "ok" : "error");
  } catch (error) {
    els.languageText.textContent = "연결 실패";
    setStatus("error", "실패");
    log(formatError(error), "error");
  }
}

async function translateSource() {
  const source = normalizeNewlines(els.sourceText.value);
  if (!source.trim()) {
    log("번역할 원문이 없습니다.", "error");
    return;
  }

  const settings = readSettings();
  saveSettings();

  const segmentSize = Math.min(settings.chunkSize, settings.requestSize);
  const tokens = tokenizeText(source, segmentSize);
  const textTokens = tokens.filter((token) => token.type === "text");

  if (!textTokens.length) {
    log("번역할 문장이 없습니다.", "error");
    return;
  }

  const glossary = buildGlossary(parseGlossary(settings.glossary));
  const protectedTexts = textTokens.map((token) => protectTerms(token.value, glossary));
  const usesPivot = settings.route === "pivot" && settings.sourceLang !== "en";
  const steps = usesPivot ? 2 : 1;

  state.abortController = new AbortController();
  state.running = true;
  state.translatedUnits = 0;
  state.totalUnits = textTokens.length * steps;
  els.koreanText.value = "";
  setUiRunning(true);
  setStatus("busy", "번역 중");
  updateProgress(0, "준비");
  clearLog();
  log(`${textTokens.length}개 조각으로 나눴습니다.`);

  try {
    let finalTexts;

    if (usesPivot) {
      updateProgress(0, "1단계: 영어");
      const englishTexts = await translateMany(protectedTexts, settings.sourceLang, "en", settings, "영어");
      updateProgress(state.translatedUnits / state.totalUnits, "2단계: 한국어");
      finalTexts = await translateMany(englishTexts, "en", "ko", settings, "한국어");
    } else {
      const sourceLang = settings.sourceLang === "auto" ? "auto" : settings.sourceLang;
      updateProgress(0, "한국어");
      finalTexts = await translateMany(protectedTexts, sourceLang, "ko", settings, "한국어");
    }

    let cursor = 0;
    const output = tokens
      .map((token) => {
        if (token.type === "break") return token.value;
        const translated = restoreTerms(cleanTranslatedText(finalTexts[cursor] || ""), glossary);
        cursor += 1;
        return translated;
      })
      .join("");

    els.koreanText.value = output;
    updateCounts();
    updateProgress(1, "완료");
    setStatus("ok", "완료");
    log("번역을 완료했습니다.", "ok");

    if (/[\u3040-\u30ff]/.test(output)) {
      log("히라가나 또는 가타카나가 일부 남아 있습니다. 해당 부분은 재번역을 권장합니다.", "error");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("idle", "중지됨");
      log("번역을 중지했습니다.", "error");
    } else {
      setStatus("error", "오류");
      log(formatError(error), "error");
    }
  } finally {
    state.running = false;
    state.abortController = null;
    setUiRunning(false);
  }
}

async function translateMany(texts, source, target, settings, label) {
  const jobs = texts.map((text, index) => ({ text, index })).filter((job) => job.text.trim());
  const results = [...texts];
  const groups = packJobs(jobs, settings.requestSize);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    throwIfAborted();
    updateProgress(
      state.totalUnits ? state.translatedUnits / state.totalUnits : 0,
      `${label} ${index + 1}/${groups.length}`
    );

    const translated = await translateGroup(group, source, target, settings);
    translated.forEach((value, translatedIndex) => {
      results[group[translatedIndex].index] = value;
    });
    state.translatedUnits += group.length;
    updateProgress(state.translatedUnits / state.totalUnits, `${label} ${index + 1}/${groups.length}`);

    if (settings.delay > 0 && index < groups.length - 1) {
      await sleep(settings.delay, state.abortController.signal);
    }
  }

  return results;
}

async function translateGroup(group, source, target, settings) {
  try {
    const translated = await callTranslateApi(
      group.map((job) => job.text),
      source,
      target,
      settings,
      state.abortController.signal
    );
    if (translated.length !== group.length) {
      throw new Error("API 응답 개수가 요청 개수와 다릅니다.");
    }
    return translated;
  } catch (error) {
    if (error.name === "AbortError" || group.length === 1) {
      throw error;
    }

    const middle = Math.ceil(group.length / 2);
    const left = await translateGroup(group.slice(0, middle), source, target, settings);
    if (settings.delay > 0) {
      await sleep(settings.delay, state.abortController.signal);
    }
    const right = await translateGroup(group.slice(middle), source, target, settings);
    return [...left, ...right];
  }
}

async function callTranslateApi(q, source, target, settings, signal) {
  const body = {
    q,
    source,
    target,
    format: "text",
  };

  if (settings.apiKey) {
    body.api_key = settings.apiKey;
  }

  const data = await fetchJson(settings, "/translate", {
    method: "POST",
    body,
    signal,
  });

  const translatedText = data.translatedText;
  if (Array.isArray(translatedText)) {
    return translatedText.map((item) => String(item ?? ""));
  }
  if (typeof translatedText === "string" && q.length === 1) {
    return [translatedText];
  }
  throw new Error("API 응답에서 translatedText를 읽을 수 없습니다.");
}

async function fetchJson(settings, path, options = {}) {
  const headers = { Accept: "application/json" };
  const init = {
    method: options.method || "GET",
    headers,
    signal: options.signal,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${settings.endpoint}${path}`, init);
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { error: raw || response.statusText };
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

function tokenizeText(input, maxChars) {
  const normalized = normalizePastedText(input);
  const parts = normalized.split(/(\n+)/);
  const tokens = [];

  parts.forEach((part) => {
    if (!part) return;
    if (/^\n+$/.test(part)) {
      tokens.push({ type: "break", value: part });
      return;
    }

    splitLongText(part, maxChars).forEach((value) => {
      if (value) tokens.push({ type: "text", value });
    });
  });

  return tokens;
}

function splitLongText(text, maxChars) {
  if (text.length <= maxChars) return [text];

  const units = [];
  let buffer = "";
  for (const char of text) {
    buffer += char;
    if (/[。！？!?]/.test(char)) {
      units.push(buffer);
      buffer = "";
    }
  }
  if (buffer) units.push(buffer);

  const chunks = [];
  let current = "";

  units.forEach((unit) => {
    if (unit.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...hardSplit(unit, maxChars));
      return;
    }

    if (current && current.length + unit.length > maxChars) {
      chunks.push(current);
      current = unit;
    } else {
      current += unit;
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(text, maxChars) {
  const chunks = [];
  let rest = text;

  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars + 1);
    const cut = findCutPoint(slice, maxChars);
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }

  if (rest) chunks.push(rest);
  return chunks;
}

function findCutPoint(text, fallback) {
  const marks = ["。", "！", "？", ".", "!", "?", "、", ",", " "];
  for (const mark of marks) {
    const index = text.lastIndexOf(mark);
    if (index > Math.floor(fallback * 0.45)) {
      return index + 1;
    }
  }
  return fallback;
}

function packJobs(jobs, maxChars) {
  const groups = [];
  let current = [];
  let currentSize = 0;

  jobs.forEach((job) => {
    const size = Math.max(1, job.text.length);
    if (current.length && currentSize + size > maxChars) {
      groups.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(job);
    currentSize += size;
  });

  if (current.length) groups.push(current);
  return groups;
}

function parseGlossary(value) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.includes("=") ? "=" : "\t";
      const [source, ...targetParts] = line.split(separator);
      return {
        source: source?.trim() || "",
        target: targetParts.join(separator).trim(),
      };
    })
    .filter((entry) => entry.source && entry.target);
}

function buildGlossary(entries) {
  return entries
    .map((entry, index) => ({
      ...entry,
      token: `ZXQTERM${String(index).padStart(4, "0")}ZXQ`,
    }))
    .sort((a, b) => b.source.length - a.source.length);
}

function protectTerms(text, glossary) {
  return glossary.reduce((next, entry) => next.split(entry.source).join(entry.token), text);
}

function restoreTerms(text, glossary) {
  return glossary.reduce((next, entry) => next.split(entry.token).join(entry.target), text);
}

function cleanTranslatedText(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
}

function normalizePaste(event) {
  const text = event.clipboardData?.getData("text/plain");
  if (text == null) return;
  event.preventDefault();
  insertTextAtCursor(els.sourceText, normalizePastedText(text));
  updateCounts();
}

function normalizeSourceText() {
  els.sourceText.value = normalizePastedText(els.sourceText.value);
  updateCounts();
  log("원문의 과한 빈 줄을 정리했습니다.");
}

function normalizePastedText(text) {
  return normalizeNewlines(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const next = start + text.length;
  textarea.setSelectionRange(next, next);
}

function cancelTranslation() {
  state.abortController?.abort();
}

function clearSource() {
  if (state.running) return;
  els.sourceText.value = "";
  els.koreanText.value = "";
  clearLog();
  updateCounts();
  updateProgress(0, "원문 대기");
  setStatus("idle", "대기");
}

async function copyOutput() {
  const text = els.koreanText.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  log("번역문을 복사했습니다.", "ok");
}

function downloadOutput() {
  const text = els.koreanText.value;
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `translated-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function loadTextFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    els.sourceText.value = normalizePastedText(String(reader.result || ""));
    updateCounts();
    log(`${file.name} 파일을 불러왔습니다.`, "ok");
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

function updateCounts() {
  const sourceLength = els.sourceText.value.length;
  const outputLength = els.koreanText.value.length;
  els.sourceCount.textContent = `${sourceLength.toLocaleString("ko-KR")}자`;
  els.koreanCount.textContent = `${outputLength.toLocaleString("ko-KR")}자`;

  const chunkSize = clampNumber(els.chunkSizeInput.value, 300, 5000, DEFAULT_SETTINGS.chunkSize);
  const chunks = sourceLength ? tokenizeText(els.sourceText.value, chunkSize).filter((token) => token.type === "text") : [];
  els.chunkText.textContent = `${chunks.length.toLocaleString("ko-KR")}개 조각`;
}

function updateProgress(value, stage) {
  const normalized = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  els.progressBar.style.width = `${Math.round(normalized * 100)}%`;
  els.progressText.textContent = `${Math.round(normalized * 100)}%`;
  els.stageText.textContent = stage;
}

function setUiRunning(isRunning) {
  els.translateButton.disabled = isRunning;
  els.cancelButton.disabled = !isRunning;
  [
    els.endpointInput,
    els.apiKeyInput,
    els.sourceLangInput,
    els.routeInput,
    els.chunkSizeInput,
    els.requestSizeInput,
    els.delayInput,
    els.glossaryInput,
    els.checkButton,
    els.loadButton,
    els.normalizeButton,
    els.clearButton,
  ].forEach((el) => {
    el.disabled = isRunning;
  });
}

function setStatus(kind, text) {
  els.statusDot.className = "status-dot";
  if (kind === "ok") els.statusDot.classList.add("ok");
  if (kind === "busy") els.statusDot.classList.add("busy");
  if (kind === "error") els.statusDot.classList.add("error");
  els.statusText.textContent = text;
}

function log(message, kind = "") {
  const item = document.createElement("li");
  if (kind) item.className = kind;
  item.textContent = message;
  els.logList.append(item);
  els.logList.scrollTop = els.logList.scrollHeight;
}

function clearLog() {
  els.logList.replaceChildren();
}

function normalizeEndpoint(value) {
  const trimmed = String(value).trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_SETTINGS.endpoint;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function throwIfAborted() {
  if (state.abortController?.signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function formatError(error) {
  const message = error?.message || String(error);
  if (message.includes("Failed to fetch")) {
    return "API에 연결하지 못했습니다. 주소, CORS 허용, API 키를 확인하세요.";
  }
  if (message.includes("429")) {
    return "API 요청이 너무 빠릅니다. 대기 시간을 늘리거나 요청 크기를 줄이세요.";
  }
  return message;
}

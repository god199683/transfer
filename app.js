const STORAGE_KEY = "jp-en-kr-translator-settings";

const DEFAULT_SETTINGS = {
  endpoint: "https://libretranslate.com",
  chunkSize: 3000,
  delay: 350,
  retries: 2,
  saveKey: false,
  apiKey: "",
};

const els = {
  endpoint: document.querySelector("#endpointInput"),
  apiKey: document.querySelector("#apiKeyInput"),
  chunkSize: document.querySelector("#chunkSizeInput"),
  delay: document.querySelector("#delayInput"),
  retries: document.querySelector("#retryInput"),
  saveKey: document.querySelector("#saveKeyInput"),
  source: document.querySelector("#sourceText"),
  english: document.querySelector("#englishText"),
  korean: document.querySelector("#koreanText"),
  sourceCount: document.querySelector("#sourceCount"),
  englishCount: document.querySelector("#englishCount"),
  koreanCount: document.querySelector("#koreanCount"),
  chunkText: document.querySelector("#chunkText"),
  stageText: document.querySelector("#stageText"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  logList: document.querySelector("#logList"),
  translateButton: document.querySelector("#translateButton"),
  cancelButton: document.querySelector("#cancelButton"),
  clearButton: document.querySelector("#clearButton"),
  loadButton: document.querySelector("#loadButton"),
  fileInput: document.querySelector("#fileInput"),
  copyEnglishButton: document.querySelector("#copyEnglishButton"),
  copyKoreanButton: document.querySelector("#copyKoreanButton"),
  downloadButton: document.querySelector("#downloadButton"),
};

let activeController = null;
let running = false;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function readSettings() {
  return {
    endpoint: els.endpoint.value.trim() || DEFAULT_SETTINGS.endpoint,
    apiKey: els.apiKey.value.trim(),
    chunkSize: clampNumber(els.chunkSize.value, 500, 5000, DEFAULT_SETTINGS.chunkSize),
    delay: clampNumber(els.delay.value, 0, 5000, DEFAULT_SETTINGS.delay),
    retries: clampNumber(els.retries.value, 0, 5, DEFAULT_SETTINGS.retries),
    saveKey: els.saveKey.checked,
  };
}

function saveSettings() {
  const settings = readSettings();
  const safeSettings = {
    ...settings,
    apiKey: settings.saveKey ? settings.apiKey : "",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSettings));
}

function hydrateSettings() {
  const settings = loadSettings();
  els.endpoint.value = settings.endpoint;
  els.apiKey.value = settings.apiKey;
  els.chunkSize.value = settings.chunkSize;
  els.delay.value = settings.delay;
  els.retries.value = settings.retries;
  els.saveKey.checked = Boolean(settings.saveKey);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function countChars(value) {
  return Array.from(value || "").length;
}

function updateCounts() {
  els.sourceCount.textContent = `${countChars(els.source.value).toLocaleString("ko-KR")}자`;
  els.englishCount.textContent = `${countChars(els.english.value).toLocaleString("ko-KR")}자`;
  els.koreanCount.textContent = `${countChars(els.korean.value).toLocaleString("ko-KR")}자`;
}

function setStatus(text, mode = "idle") {
  els.statusText.textContent = text;
  els.statusDot.classList.toggle("running", mode === "running");
  els.statusDot.classList.toggle("error", mode === "error");
}

function setProgress(percent, stage) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  els.progressBar.style.width = `${safePercent}%`;
  els.progressText.textContent = `${safePercent}%`;
  if (stage) els.stageText.textContent = stage;
}

function addLog(message) {
  const item = document.createElement("li");
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
  item.textContent = `[${time}] ${message}`;
  els.logList.append(item);
  els.logList.scrollTop = els.logList.scrollHeight;
}

function clearLog() {
  els.logList.replaceChildren();
}

function setRunning(nextRunning) {
  running = nextRunning;
  els.translateButton.disabled = nextRunning;
  els.cancelButton.disabled = !nextRunning;
  els.loadButton.disabled = nextRunning;
  els.clearButton.disabled = nextRunning;
  [
    els.endpoint,
    els.apiKey,
    els.chunkSize,
    els.delay,
    els.retries,
    els.saveKey,
  ].forEach((el) => {
    el.disabled = nextRunning;
  });
}

function splitForTranslation(text, limit) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/(\n{2,})/);
  const chunks = [];

  for (const block of blocks) {
    if (!block) continue;
    if (/^\n{2,}$/.test(block)) {
      if (chunks.length > 0) {
        chunks[chunks.length - 1].suffix += block;
      }
      continue;
    }

    const pieces = sliceBlock(block, limit);
    pieces.forEach((piece, index) => {
      const isLastPiece = index === pieces.length - 1;
      chunks.push({
        text: piece,
        suffix: isLastPiece ? "" : "\n",
      });
    });
  }

  return chunks.filter((chunk) => chunk.text.trim().length > 0);
}

function sliceBlock(block, limit) {
  if (block.length <= limit) return [block.trim()];

  const chunks = [];
  let start = 0;

  while (start < block.length) {
    const hardEnd = Math.min(start + limit, block.length);
    let end = hardEnd;

    if (hardEnd < block.length) {
      const windowText = block.slice(start, hardEnd);
      const breakPoint = findBreakPoint(windowText, limit);
      if (breakPoint > Math.floor(limit * 0.42)) {
        end = start + breakPoint;
      }
    }

    const piece = block.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end === start ? hardEnd : end;
  }

  return chunks;
}

function findBreakPoint(text, limit) {
  const patterns = [
    /\n/g,
    /[。！？.!?]["'”’)\]]*\s*/g,
    /[、,;；:：]\s*/g,
    /\s+/g,
  ];
  let best = -1;

  for (const pattern of patterns) {
    let match = pattern.exec(text);
    while (match) {
      best = Math.max(best, match.index + match[0].length);
      match = pattern.exec(text);
    }
    pattern.lastIndex = 0;
    if (best > Math.floor(limit * 0.72)) break;
  }

  return best > 0 ? best : limit;
}

async function translateChunks(chunks, source, target, settings, stage, offset, span) {
  let output = "";
  const total = chunks.length;

  for (let index = 0; index < total; index += 1) {
    const chunk = chunks[index];
    const stageLabel = `${stage} ${index + 1}/${total}`;
    setProgress(offset + (index / total) * span, stageLabel);
    addLog(`${stageLabel} 처리 중`);

    const translated = await translateWithRetry(chunk.text, source, target, settings, stageLabel);
    output += `${translated}${chunk.suffix}`;

    if (source === "ja") {
      els.english.value = output;
    } else {
      els.korean.value = output;
    }
    updateCounts();

    setProgress(offset + ((index + 1) / total) * span, stageLabel);
    if (settings.delay > 0 && index < total - 1) {
      await wait(settings.delay, activeController.signal);
    }
  }

  return output.trim();
}

async function translateWithRetry(text, source, target, settings, label) {
  let lastError = null;

  for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
    try {
      return await translateLibre(text, source, target, settings, activeController.signal);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      lastError = error;
      if (attempt < settings.retries) {
        const pause = 600 + attempt * 700;
        addLog(`${label} 재시도 ${attempt + 1}/${settings.retries}`);
        await wait(pause, activeController.signal);
      }
    }
  }

  throw lastError || new Error("번역 요청에 실패했습니다.");
}

async function translateLibre(text, source, target, settings, signal) {
  const endpoint = settings.endpoint.replace(/\/+$/, "");
  const response = await fetch(`${endpoint}/translate`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: "text",
      api_key: settings.apiKey || undefined,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${details ? `: ${details}` : ""}`);
  }

  const data = await response.json();
  const translated = data.translatedText || data.translation || data.text;

  if (typeof translated !== "string") {
    throw new Error("번역 응답 형식이 올바르지 않습니다.");
  }

  return translated;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("작업이 중지되었습니다.", "AbortError"));
      },
      { once: true },
    );
  });
}

async function runTranslation() {
  if (running) return;

  const sourceText = els.source.value.trim();
  if (!sourceText) {
    setStatus("입력 필요", "error");
    addLog("일본어 원문이 비어 있습니다.");
    els.source.focus();
    return;
  }

  const settings = readSettings();
  saveSettings();
  activeController = new AbortController();
  setRunning(true);
  setStatus("번역 중", "running");
  setProgress(0, "준비 중");
  clearLog();
  els.english.value = "";
  els.korean.value = "";
  updateCounts();

  try {
    const jaChunks = splitForTranslation(sourceText, settings.chunkSize);
    els.chunkText.textContent = `${jaChunks.length.toLocaleString("ko-KR")}개 청크`;
    addLog(`일본어 원문 ${countChars(sourceText).toLocaleString("ko-KR")}자`);

    const englishText = await translateChunks(
      jaChunks,
      "ja",
      "en",
      settings,
      "일본어 -> 영어",
      0,
      50,
    );

    const enChunks = splitForTranslation(englishText, settings.chunkSize);
    els.chunkText.textContent = `${(jaChunks.length + enChunks.length).toLocaleString("ko-KR")}개 청크`;
    addLog(`영어 중간본 ${countChars(englishText).toLocaleString("ko-KR")}자`);

    await translateChunks(enChunks, "en", "ko", settings, "영어 -> 한국어", 50, 50);

    setProgress(100, "완료");
    setStatus("완료", "idle");
    addLog("번역 완료");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("중지됨", "idle");
      setProgress(0, "중지됨");
      addLog("사용자가 작업을 중지했습니다.");
    } else {
      setStatus("오류", "error");
      addLog(error.message || "번역 중 오류가 발생했습니다.");
    }
  } finally {
    activeController = null;
    setRunning(false);
    updateCounts();
  }
}

function stopTranslation() {
  if (activeController) activeController.abort();
}

async function copyText(text, label) {
  if (!text.trim()) {
    addLog(`${label} 내용이 비어 있습니다.`);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    addLog(`${label} 복사 완료`);
  } catch {
    addLog(`${label} 복사 권한을 확인하세요.`);
  }
}

function downloadKorean() {
  const text = els.korean.value.trim();
  if (!text) {
    addLog("저장할 한국어 결과가 없습니다.");
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jp-en-kr-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  addLog("한국어 결과 저장 완료");
}

async function loadTextFile(file) {
  if (!file) return;
  const text = await file.text();
  els.source.value = text;
  els.english.value = "";
  els.korean.value = "";
  updateCounts();
  setProgress(0, "입력 대기");
  setStatus("대기", "idle");
  addLog(`${file.name} 불러오기 완료`);
}

function bindEvents() {
  [els.endpoint, els.apiKey, els.chunkSize, els.delay, els.retries, els.saveKey].forEach((el) => {
    el.addEventListener("change", saveSettings);
  });

  els.source.addEventListener("input", () => {
    updateCounts();
    const settings = readSettings();
    const chunks = splitForTranslation(els.source.value, settings.chunkSize);
    els.chunkText.textContent = `${chunks.length.toLocaleString("ko-KR")}개 청크`;
  });

  els.translateButton.addEventListener("click", runTranslation);
  els.cancelButton.addEventListener("click", stopTranslation);
  els.clearButton.addEventListener("click", () => {
    els.source.value = "";
    els.english.value = "";
    els.korean.value = "";
    clearLog();
    setProgress(0, "입력 대기");
    setStatus("대기", "idle");
    updateCounts();
    els.chunkText.textContent = "0개 청크";
    els.source.focus();
  });
  els.loadButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    loadTextFile(event.target.files[0]).finally(() => {
      event.target.value = "";
    });
  });
  els.copyEnglishButton.addEventListener("click", () => copyText(els.english.value, "영어 중간본"));
  els.copyKoreanButton.addEventListener("click", () => copyText(els.korean.value, "한국어 결과"));
  els.downloadButton.addEventListener("click", downloadKorean);
}

hydrateSettings();
bindEvents();
updateCounts();
setProgress(0, "입력 대기");
setStatus("대기", "idle");

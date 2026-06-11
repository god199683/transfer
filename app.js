const STORAGE_KEY = "chrome-jp-en-kr-translator-settings";

const DEFAULT_SETTINGS = {
  chunkSize: 1800,
  delay: 100,
};

const LANGUAGE_PAIRS = [
  { sourceLanguage: "ja", targetLanguage: "en", label: "일본어 -> 영어" },
  { sourceLanguage: "en", targetLanguage: "ko", label: "영어 -> 한국어" },
];

const els = {
  engineText: document.querySelector("#engineText"),
  engineHint: document.querySelector("#engineHint"),
  capabilityCard: document.querySelector("#capabilityCard"),
  checkButton: document.querySelector("#checkButton"),
  chunkSize: document.querySelector("#chunkSizeInput"),
  delay: document.querySelector("#delayInput"),
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
    chunkSize: clampNumber(els.chunkSize.value, 300, 4000, DEFAULT_SETTINGS.chunkSize),
    delay: clampNumber(els.delay.value, 0, 5000, DEFAULT_SETTINGS.delay),
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettings()));
}

function hydrateSettings() {
  const settings = loadSettings();
  els.chunkSize.value = settings.chunkSize;
  els.delay.value = settings.delay;
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

function setEngineState(title, hint, mode = "idle") {
  els.engineText.textContent = title;
  els.engineHint.textContent = hint;
  els.capabilityCard.classList.toggle("available", mode === "available");
  els.capabilityCard.classList.toggle("error", mode === "error");
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
  els.checkButton.disabled = nextRunning;
  els.chunkSize.disabled = nextRunning;
  els.delay.disabled = nextRunning;
}

function getTranslatorApi() {
  return globalThis.Translator || null;
}

async function checkTranslatorSupport({ log = false } = {}) {
  const TranslatorApi = getTranslatorApi();

  if (!TranslatorApi) {
    setStatus("미지원", "error");
    setEngineState(
      "이 브라우저는 내장 번역을 지원하지 않습니다.",
      "데스크톱 Chrome 138 이상 필요",
      "error",
    );
    els.translateButton.disabled = true;
    if (log) addLog("Chrome Translator API를 찾을 수 없습니다.");
    return false;
  }

  try {
    const results = [];
    for (const pair of LANGUAGE_PAIRS) {
      const availability = await TranslatorApi.availability({
        sourceLanguage: pair.sourceLanguage,
        targetLanguage: pair.targetLanguage,
      });
      results.push(`${pair.label}: ${availability}`);
    }

    const unavailable = results.some((result) => result.includes("unavailable"));
    if (unavailable) {
      setStatus("언어 미지원", "error");
      setEngineState(
        "필요한 언어쌍을 사용할 수 없습니다.",
        "Chrome 언어팩 상태를 확인해 주세요.",
        "error",
      );
      els.translateButton.disabled = true;
      if (log) addLog(results.join(" / "));
      return false;
    }

    setStatus("사용 가능", "idle");
    setEngineState(
      "Chrome 내장 번역 사용 가능",
      "첫 번역 때 언어팩을 받을 수 있습니다.",
      "available",
    );
    els.translateButton.disabled = false;
    if (log) addLog(results.join(" / "));
    return true;
  } catch (error) {
    setStatus("확인 실패", "error");
    setEngineState(
      "번역 지원 상태를 확인하지 못했습니다.",
      error.message || "Chrome 설정을 확인해 주세요.",
      "error",
    );
    els.translateButton.disabled = true;
    if (log) addLog(error.message || "지원 상태 확인 실패");
    return false;
  }
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

async function createTranslator(sourceLanguage, targetLanguage, label) {
  const TranslatorApi = getTranslatorApi();
  if (!TranslatorApi) {
    throw new Error("Chrome Translator API를 사용할 수 없습니다.");
  }

  setProgress(undefinedToZero(els.progressText.textContent), `${label} 준비 중`);
  addLog(`${label} 번역기 준비 중`);

  const translator = await TranslatorApi.create({
    sourceLanguage,
    targetLanguage,
    monitor(monitorTarget) {
      monitorTarget.addEventListener("downloadprogress", (event) => {
        const percent = Math.round((event.loaded || 0) * 100);
        setEngineState(
          "언어팩 다운로드 중",
          `${label} ${percent}% 준비됨`,
          "available",
        );
      });
    },
  });

  if (translator.ready) {
    await translator.ready;
  }

  return translator;
}

function undefinedToZero(value) {
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : 0;
}

async function translateChunks(chunks, translator, source, stage, offset, span, settings) {
  let output = "";
  const total = chunks.length;

  for (let index = 0; index < total; index += 1) {
    throwIfAborted();
    const chunk = chunks[index];
    const stageLabel = `${stage} ${index + 1}/${total}`;
    setProgress(offset + (index / total) * span, stageLabel);
    addLog(`${stageLabel} 처리 중`);

    const translated = await translator.translate(chunk.text);
    throwIfAborted();
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

function throwIfAborted() {
  if (activeController?.signal.aborted) {
    throw new DOMException("작업이 중지되었습니다.", "AbortError");
  }
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

  const supported = await checkTranslatorSupport();
  if (!supported) return;

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

  let jaEnTranslator = null;
  let enKoTranslator = null;

  try {
    const jaChunks = splitForTranslation(sourceText, settings.chunkSize);
    els.chunkText.textContent = `${jaChunks.length.toLocaleString("ko-KR")}개 청크`;
    addLog(`일본어 원문 ${countChars(sourceText).toLocaleString("ko-KR")}자`);

    jaEnTranslator = await createTranslator("ja", "en", "일본어 -> 영어");
    const englishText = await translateChunks(
      jaChunks,
      jaEnTranslator,
      "ja",
      "일본어 -> 영어",
      0,
      50,
      settings,
    );

    const enChunks = splitForTranslation(englishText, settings.chunkSize);
    els.chunkText.textContent = `${(jaChunks.length + enChunks.length).toLocaleString("ko-KR")}개 청크`;
    addLog(`영어 중간본 ${countChars(englishText).toLocaleString("ko-KR")}자`);

    enKoTranslator = await createTranslator("en", "ko", "영어 -> 한국어");
    await translateChunks(
      enChunks,
      enKoTranslator,
      "en",
      "영어 -> 한국어",
      50,
      50,
      settings,
    );

    setProgress(100, "완료");
    setStatus("완료", "idle");
    setEngineState(
      "Chrome 내장 번역 사용 가능",
      "번역이 브라우저 안에서 처리되었습니다.",
      "available",
    );
    addLog("번역 완료");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("중지됨", "idle");
      setProgress(0, "중지됨");
      addLog("사용자가 작업을 중지했습니다.");
    } else {
      setStatus("오류", "error");
      setEngineState(
      "번역 중 오류가 발생했습니다.",
        error.message || "Chrome 번역 상태를 확인해 주세요.",
        "error",
      );
      addLog(error.message || "번역 중 오류가 발생했습니다.");
    }
  } finally {
    jaEnTranslator?.destroy?.();
    enKoTranslator?.destroy?.();
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
  updateChunkCount();
  setProgress(0, "입력 대기");
  setStatus("대기", "idle");
  addLog(`${file.name} 불러오기 완료`);
}

function updateChunkCount() {
  const settings = readSettings();
  const chunks = splitForTranslation(els.source.value, settings.chunkSize);
  els.chunkText.textContent = `${chunks.length.toLocaleString("ko-KR")}개 청크`;
}

function clearAll() {
  els.source.value = "";
  els.english.value = "";
  els.korean.value = "";
  clearLog();
  setProgress(0, "입력 대기");
  setStatus("대기", "idle");
  updateCounts();
  els.chunkText.textContent = "0개 청크";
  els.source.focus();
}

function bindEvents() {
  [els.chunkSize, els.delay].forEach((el) => {
    el.addEventListener("change", () => {
      saveSettings();
      updateChunkCount();
    });
  });

  els.source.addEventListener("input", () => {
    updateCounts();
    updateChunkCount();
  });

  els.checkButton.addEventListener("click", () => checkTranslatorSupport({ log: true }));
  els.translateButton.addEventListener("click", runTranslation);
  els.cancelButton.addEventListener("click", stopTranslation);
  els.clearButton.addEventListener("click", clearAll);
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
updateChunkCount();
setProgress(0, "입력 대기");
setStatus("확인 중", "idle");
els.translateButton.disabled = true;
checkTranslatorSupport();

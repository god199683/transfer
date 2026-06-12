const STORAGE_KEY = "ollama-light-novel-translator-settings";

const DEFAULT_TRANSLATION_PROMPT = `당신은 일본어·영어 라이트노벨 전문 번역가이자 한국어 현지화 전문가입니다.

사용자가 입력한 원문을 한국어로 번역합니다.

목표는 단순한 직역이 아니라, 한국의 라이트노벨 독자가 자연스럽게 읽을 수 있는 수준의 고품질 번역을 제공하는 것입니다. DeepL 수준의 자연스러움과 가독성을 목표로 하되, 원문의 의미·감정·캐릭터성을 최대한 유지해야 합니다.

번역 원칙:

1. 원문의 의미, 의도, 감정, 분위기를 최우선으로 보존한다.
2. 직역보다 자연스러운 한국어 표현을 우선한다.
3. 번역투를 제거하고 한국어 화자가 실제로 사용하는 문장으로 다듬는다.
4. 문맥상 자연스럽다면 문장 구조를 재배열할 수 있다.
5. 원문에 없는 내용을 추가하거나 의미를 왜곡하지 않는다.
6. 설명, 해설, 주석, 번역자의 코멘트를 추가하지 않는다.
7. 출력은 번역문만 제공한다.
8. 문단 구성은 가능한 한 원문을 유지한다.
9. 반복되는 주어나 불필요한 대명사는 한국어 문맥에 맞게 자연스럽게 생략한다.
10. 한국어 문장이 지나치게 길어지면 적절히 분리하여 가독성을 높인다.

문체 규칙:

- 서술문은 한국 출판 라이트노벨 스타일을 따른다.
- 지나치게 딱딱한 문어체나 기계적인 표현을 피한다.
- 지나치게 인터넷체, 밈 표현, 현대 유행어를 사용하지 않는다.
- 독자가 소설을 읽는 느낌을 해치지 않는 자연스러운 문장을 사용한다.
- 캐릭터마다 말투의 차이를 유지한다.
- 감정 표현은 원문의 강도를 유지한다.
- 독백, 대사, 서술을 명확히 구분한다.

대사 번역 규칙:

- 캐릭터의 성격, 나이, 관계성, 사회적 위치를 고려해 말투를 유지한다.
- 반말과 존댓말을 문맥에 맞게 자연스럽게 적용한다.
- 일본어 경어를 기계적으로 옮기지 않는다.
- 과도한 의역으로 캐릭터성이 변하지 않도록 한다.
- 말버릇이나 반복되는 표현은 가능한 한 일관되게 유지한다.

고유명사 규칙:

- 작품 내 고유명사, 인명, 지명, 기술명, 스킬명은 일관성을 유지한다.
- 이미 널리 알려진 공식 번역명이 있다면 우선 사용한다.
- 공식 번역명이 없는 경우 발음과 의미를 고려하여 자연스럽게 표기한다.

의성어·의태어 규칙:

- 직역하지 말고 한국 독자가 자연스럽게 이해할 수 있는 표현으로 변환한다.
- 장면의 분위기와 리듬감을 유지한다.

문화적 표현 규칙:

- 일본어 또는 외국어 특유의 표현은 한국 독자가 자연스럽게 읽을 수 있도록 현지화한다.
- 단, 작품의 배경과 정체성을 훼손하지 않는다.

품질 우선순위:

원문의 의미 보존
→ 자연스러운 한국어
→ 캐릭터성 유지
→ 감정 전달
→ 문장 흐름
→ 직역 충실도

번역 결과는 "번역된 것처럼 보이는 문장"이 아니라, "처음부터 한국어로 출간된 라이트노벨"처럼 읽혀야 한다.

사용자가 입력한 텍스트를 위 원칙에 따라 한국어로 번역하라.
등장인물의 감정 표현, 연애 묘사, 폭력 묘사, 성인 대상 서술은 원문의 수위와 뉘앙스를 유지하며 완전하게 번역한다.

최종 출력은 번역문만 제공한다.`;

const DEFAULT_SETTINGS = {
  model: "qwen3:8b",
  chunkSize: 2400,
  temperature: 0.2,
  glossary: "",
  prompt: DEFAULT_TRANSLATION_PROMPT,
};

const els = {
  engineText: document.querySelector("#engineText"),
  engineHint: document.querySelector("#engineHint"),
  capabilityCard: document.querySelector("#capabilityCard"),
  checkButton: document.querySelector("#checkButton"),
  model: document.querySelector("#modelInput"),
  modelList: document.querySelector("#modelList"),
  chunkSize: document.querySelector("#chunkSizeInput"),
  temperature: document.querySelector("#temperatureInput"),
  glossary: document.querySelector("#glossaryInput"),
  prompt: document.querySelector("#promptInput"),
  source: document.querySelector("#sourceText"),
  korean: document.querySelector("#koreanText"),
  sourceCount: document.querySelector("#sourceCount"),
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
    model: els.model.value.trim() || DEFAULT_SETTINGS.model,
    chunkSize: clampNumber(els.chunkSize.value, 500, 8000, DEFAULT_SETTINGS.chunkSize),
    temperature: clampNumber(els.temperature.value, 0, 1.2, DEFAULT_SETTINGS.temperature),
    glossary: els.glossary.value,
    prompt: els.prompt.value.trim() || DEFAULT_TRANSLATION_PROMPT,
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettings()));
}

function hydrateSettings() {
  const settings = loadSettings();
  els.model.value = settings.model;
  els.chunkSize.value = settings.chunkSize;
  els.temperature.value = settings.temperature;
  els.glossary.value = settings.glossary;
  els.prompt.value = settings.prompt || DEFAULT_TRANSLATION_PROMPT;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function countChars(value) {
  return Array.from(value || "").length;
}

function updateCounts() {
  els.sourceCount.textContent = `${countChars(els.source.value).toLocaleString("ko-KR")}자`;
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
  els.model.disabled = nextRunning;
  els.chunkSize.disabled = nextRunning;
  els.temperature.disabled = nextRunning;
  els.glossary.disabled = nextRunning;
  els.prompt.disabled = nextRunning;
}

async function checkOllama({ log = false } = {}) {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Ollama 연결 실패");
    }

    els.modelList.replaceChildren(
      ...data.models.map((model) => {
        const option = document.createElement("option");
        option.value = model;
        return option;
      }),
    );
    setStatus("사용 가능", "idle");
    setEngineState(
      "Ollama 연결됨",
      data.models.length > 0
        ? `${data.models.length.toLocaleString("ko-KR")}개 로컬 모델 사용 가능`
        : "모델을 먼저 설치해 주세요.",
      data.models.length > 0 ? "available" : "error",
    );
    els.translateButton.disabled = data.models.length === 0;
    if (log) addLog(data.models.length > 0 ? `모델: ${data.models.join(", ")}` : "설치된 모델이 없습니다.");
    return data.models.length > 0;
  } catch (error) {
    setStatus("연결 실패", "error");
    setEngineState(
      "Ollama에 연결할 수 없습니다.",
      "Ollama를 실행한 뒤 다시 확인해 주세요.",
      "error",
    );
    els.translateButton.disabled = true;
    if (log) addLog(error.message || "Ollama 연결 실패");
    return false;
  }
}

function splitForTranslation(text, limit) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const tokens = normalized.match(/[^\n]+|\n+/g) || [];
  const chunks = [];

  for (const token of tokens) {
    if (/^\n+$/.test(token)) {
      if (chunks.length > 0) {
        chunks[chunks.length - 1].suffix += token;
      }
      continue;
    }

    const pieces = sliceBlock(token, limit);
    pieces.forEach((piece, index) => {
      const isLastPiece = index === pieces.length - 1;
      chunks.push({
        text: piece,
        suffix: isLastPiece ? "" : " ",
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

function normalizePastedText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n[ \t]*(?:\n[ \t]*)+/g, "\n")
    .replace(/^\n+|\n+$/g, "");
}

function handleSourcePaste(event) {
  const pasted = event.clipboardData?.getData("text");
  if (typeof pasted !== "string") return;

  event.preventDefault();
  const normalized = normalizePastedText(pasted);
  const start = els.source.selectionStart;
  const end = els.source.selectionEnd;
  els.source.setRangeText(normalized, start, end, "end");
  els.source.dispatchEvent(new Event("input", { bubbles: true }));
}

function parseGlossary(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(/^(.+?)\s*=\s*(.+)$/);
      if (!match) return null;
      return {
        source: match[1].trim(),
        target: match[2].trim(),
      };
    })
    .filter((entry) => entry?.source && entry?.target);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyGlossary(text, entries) {
  return entries.reduce((output, entry) => {
    return output.replace(new RegExp(escapeRegExp(entry.source), "g"), entry.target);
  }, text);
}

function hasJapaneseKana(text) {
  return /[\u3040-\u30ff]/.test(text);
}

function buildSystemPrompt(settings, glossaryEntries) {
  const glossaryPrompt =
    glossaryEntries.length > 0
      ? `\n\n사용자 용어집:\n${glossaryEntries
          .map((entry) => `${entry.source} = ${entry.target}`)
          .join("\n")}\n\n위 용어집은 모든 번역 규칙보다 우선 적용한다.`
      : "";
  return `${settings.prompt}${glossaryPrompt}`;
}

function buildChunkPrompt(chunk, index, total) {
  return `다음 원문 조각을 한국어 라이트노벨 문체로 번역하라.
번역문만 출력하라.
문단과 줄바꿈은 가능한 한 원문 형식을 유지하라.
현재 조각: ${index + 1}/${total}

[원문 시작]
${chunk}
[원문 끝]`;
}

function cleanModelOutput(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:ko|korean)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*(번역문|번역|한국어 번역)\s*[:：]\s*/i, "")
    .trim();
}

async function requestTranslation(chunk, index, total, settings, glossaryEntries) {
  const response = await fetch("/api/translate", {
    method: "POST",
    signal: activeController.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      system: buildSystemPrompt(settings, glossaryEntries),
      prompt: buildChunkPrompt(chunk, index, total),
      temperature: settings.temperature,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "번역 요청 실패");
  }

  return data.response || "";
}

async function translateChunks(chunks, settings, glossaryEntries) {
  let output = "";
  const total = chunks.length;

  for (let index = 0; index < total; index += 1) {
    throwIfAborted();
    const chunk = chunks[index];
    const stageLabel = `번역 ${index + 1}/${total}`;
    setProgress((index / total) * 100, stageLabel);
    addLog(`${stageLabel} 처리 중`);

    const rawTranslated = await requestTranslation(chunk.text, index, total, settings, glossaryEntries);
    throwIfAborted();
    const translated = applyGlossary(cleanModelOutput(rawTranslated), glossaryEntries);
    output += `${translated}${chunk.suffix}`;
    els.korean.value = output;
    updateCounts();

    setProgress(((index + 1) / total) * 100, stageLabel);
  }

  return output.trim();
}

function throwIfAborted() {
  if (activeController?.signal.aborted) {
    throw new DOMException("작업이 중지되었습니다.", "AbortError");
  }
}

async function runTranslation() {
  if (running) return;

  const sourceText = els.source.value.trim();
  if (!sourceText) {
    setStatus("입력 필요", "error");
    addLog("원문이 비어 있습니다.");
    els.source.focus();
    return;
  }

  const settings = readSettings();
  const glossaryEntries = parseGlossary(settings.glossary);
  saveSettings();
  activeController = new AbortController();

  try {
    setRunning(true);
    setStatus("번역 중", "running");
    setProgress(0, "준비 중");
    clearLog();
    els.korean.value = "";
    updateCounts();

    const chunks = splitForTranslation(sourceText, settings.chunkSize);
    els.chunkText.textContent = `${chunks.length.toLocaleString("ko-KR")}개 청크`;
    addLog(`모델: ${settings.model}`);
    addLog(`원문 ${countChars(sourceText).toLocaleString("ko-KR")}자`);
    if (glossaryEntries.length > 0) {
      addLog(`용어집 ${glossaryEntries.length.toLocaleString("ko-KR")}개 적용`);
    }

    const translatedText = await translateChunks(chunks, settings, glossaryEntries);
    els.korean.value = translatedText;
    updateCounts();

    if (hasJapaneseKana(translatedText)) {
      addLog("검수: 한국어 결과에 일본어 가나가 남아 있습니다.");
    }

    setProgress(100, "완료");
    setStatus("완료", "idle");
    setEngineState("Ollama 연결됨", "로컬 모델로 번역했습니다.", "available");
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
        error.message || "Ollama와 모델 상태를 확인해 주세요.",
        "error",
      );
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
    addLog("저장할 한국어 번역이 없습니다.");
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `light-novel-ko-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  addLog("한국어 번역 저장 완료");
}

async function loadTextFile(file) {
  if (!file) return;
  const text = normalizePastedText(await file.text());
  els.source.value = text;
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
  els.korean.value = "";
  clearLog();
  setProgress(0, "입력 대기");
  setStatus("대기", "idle");
  updateCounts();
  els.chunkText.textContent = "0개 청크";
  els.source.focus();
}

function bindEvents() {
  [els.model, els.chunkSize, els.temperature, els.glossary, els.prompt].forEach((el) => {
    el.addEventListener("change", () => {
      saveSettings();
      updateChunkCount();
    });
  });

  els.source.addEventListener("input", () => {
    updateCounts();
    updateChunkCount();
  });
  els.source.addEventListener("paste", handleSourcePaste);

  els.checkButton.addEventListener("click", () => checkOllama({ log: true }));
  els.translateButton.addEventListener("click", runTranslation);
  els.cancelButton.addEventListener("click", stopTranslation);
  els.clearButton.addEventListener("click", clearAll);
  els.loadButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    loadTextFile(event.target.files[0]).finally(() => {
      event.target.value = "";
    });
  });
  els.copyKoreanButton.addEventListener("click", () => copyText(els.korean.value, "한국어 번역"));
  els.downloadButton.addEventListener("click", downloadKorean);
}

hydrateSettings();
bindEvents();
updateCounts();
updateChunkCount();
setProgress(0, "입력 대기");
setStatus("확인 중", "idle");
els.translateButton.disabled = true;
checkOllama();

const AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
const DEFAULT_ALLOWED_ORIGIN = "https://god199683.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
    const corsHeaders = buildCorsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return json(
          {
            ok: Boolean(env.AZURE_TRANSLATOR_KEY),
            message: env.AZURE_TRANSLATOR_KEY
              ? "Azure Translator Worker is ready."
              : "AZURE_TRANSLATOR_KEY is missing.",
          },
          env.AZURE_TRANSLATOR_KEY ? 200 : 500,
          corsHeaders
        );
      }

      if (url.pathname === "/api/translate") {
        return handleTranslate(request, env, corsHeaders);
      }

      if (url.pathname === "/api/narou") {
        return handleNarou(url, corsHeaders);
      }

      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, corsHeaders);
    }
  },
};

async function handleTranslate(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  if (!env.AZURE_TRANSLATOR_KEY) {
    return json({ error: "AZURE_TRANSLATOR_KEY is missing." }, 500, corsHeaders);
  }

  const payload = await request.json();
  const q = Array.isArray(payload.q) ? payload.q.map((item) => String(item ?? "")) : [];
  const source = payload.source === "auto" ? "" : String(payload.source || "");
  const target = String(payload.target || "ko");

  if (!q.length || q.length > 1000) {
    return json({ error: "q must be an array with 1-1000 items." }, 400, corsHeaders);
  }

  const totalChars = q.reduce((sum, text) => sum + text.length, 0);
  if (totalChars > 50000) {
    return json({ error: "Azure request exceeds 50,000 characters." }, 400, corsHeaders);
  }

  const params = new URLSearchParams({
    "api-version": "3.0",
    to: target,
    textType: "plain",
    profanityAction: "NoAction",
  });

  if (source) {
    params.set("from", source);
  }

  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY,
  };

  if (env.AZURE_TRANSLATOR_REGION) {
    headers["Ocp-Apim-Subscription-Region"] = env.AZURE_TRANSLATOR_REGION;
  }

  const endpoint = (env.AZURE_TRANSLATOR_ENDPOINT || AZURE_ENDPOINT).replace(/\/+$/, "");
  const azureResponse = await fetch(`${endpoint}/translate?${params.toString()}`, {
    method: "POST",
    headers,
    body: JSON.stringify(q.map((text) => ({ Text: text }))),
  });

  const raw = await azureResponse.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { error: raw };
  }

  if (!azureResponse.ok) {
    return json(
      {
        error:
          data?.error?.message ||
          data?.message ||
          data?.error ||
          `${azureResponse.status} ${azureResponse.statusText}`,
      },
      azureResponse.status,
      corsHeaders
    );
  }

  const translatedText = data.map((item) => item?.translations?.[0]?.text || "");
  return json({ translatedText }, 200, corsHeaders);
}

async function handleNarou(url, corsHeaders) {
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) {
    return json({ error: "url is required." }, 400, corsHeaders);
  }

  const target = normalizeNarouUrl(rawUrl);
  const response = await fetch(target, {
    headers: {
      "User-Agent": "Mozilla/5.0 NarouLongTranslator/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    return json({ error: `Narou fetch failed: ${response.status}` }, response.status, corsHeaders);
  }

  const html = await response.text();
  const chapter = extractNarouChapter(html, target);
  if (chapter.text.trim()) {
    return json(chapter, 200, corsHeaders);
  }

  const index = extractNarouIndex(html, target);
  if (index.chapterCount) {
    return json(index, 200, corsHeaders);
  }

  return json({ error: "Narou content was not found." }, 404, corsHeaders);
}

function normalizeNarouUrl(value) {
  const url = new URL(value);
  if (url.hostname !== "ncode.syosetu.com") {
    throw new Error("Only ncode.syosetu.com URLs are supported.");
  }
  url.protocol = "https:";
  url.hash = "";
  return url.toString();
}

function extractNarouChapter(html, url) {
  const title = decodeHtml(
    matchText(html, /<h1[^>]*class=["'][^"']*p-novel__title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      matchText(html, /<p[^>]*class=["']novel_title["'][^>]*>([\s\S]*?)<\/p>/i) ||
      ""
  );
  const subtitle = decodeHtml(
    matchText(html, /<div[^>]*class=["'][^"']*p-novel__subtitle[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      matchText(html, /<p[^>]*class=["']novel_subtitle["'][^>]*>([\s\S]*?)<\/p>/i) ||
      ""
  );
  const bodyHtml =
    matchText(html, /<div[^>]*id=["']novel_honbun["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*id=["']novel_a["']/i) ||
    matchText(html, /<div[^>]*class=["'][^"']*js-novel-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
    matchText(html, /<div[^>]*class=["']novel_view["'][^>]*>([\s\S]*?)<\/div>/i) ||
    "";
  const text = htmlToText(bodyHtml);
  const heading = [title, subtitle].filter(Boolean).join("\n");

  return {
    kind: "chapter",
    url,
    title: subtitle || title || "",
    text: heading ? `${heading}\n\n${text}` : text,
  };
}

function extractNarouIndex(html, url) {
  const ncode = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
  const chapters = [];
  const seen = new Set();
  const linkPattern = /<a[^>]+href=["'](\/n\d+[a-z]+\/\d+\/)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html))) {
    const href = match[1];
    if (!href.includes(`/${ncode}/`) || seen.has(href)) continue;
    seen.add(href);
    chapters.push({
      url: `https://ncode.syosetu.com${href}`,
      title: decodeHtml(stripTags(match[2])).trim(),
    });
  }

  return {
    kind: "index",
    url,
    chapterCount: chapters.length,
    firstChapterUrl: chapters[0]?.url || "",
    chapters: chapters.slice(0, 100),
  };
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi, "$1")
      .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function matchText(value, pattern) {
  const match = value.match(pattern);
  return match?.[1] || "";
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function buildCorsHeaders(origin, allowedOrigin) {
  const allowOrigin = origin && (allowedOrigin === "*" || origin === allowedOrigin) ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

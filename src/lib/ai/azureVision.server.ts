/**
 * Azure AI Vision OCR — SERVER ONLY.
 * Import exclusively from Route Handlers (e.g. src/app/api/navi/ocr/route.ts).
 *
 * Primary: Image Analysis 4.0 Read (`computervision/imageanalysis:analyze?features=read`)
 * — synchronous, strong on receipt photos, no polling.
 * Fallback: Cognitive Services OCR v3.2 (`vision/v3.2/ocr`) if 4.0 is unavailable
 * (404/405) or returns empty text.
 */

export interface AzureVisionConfig {
  endpoint: string;
  key: string;
}

export function getVisionConfig(): AzureVisionConfig | null {
  const endpoint = process.env.AZURE_VISION_ENDPOINT?.trim();
  const key = process.env.AZURE_VISION_KEY?.trim();
  if (!endpoint || !key) return null;
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    key,
  };
}

export function isVisionConfigured(): boolean {
  return getVisionConfig() !== null;
}

function stripDataUrl(base64OrDataUrl: string): Buffer {
  const trimmed = base64OrDataUrl.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (match) {
    return Buffer.from(match[2], "base64");
  }
  return Buffer.from(trimmed, "base64");
}

interface ImageAnalysisReadResponse {
  readResult?: {
    blocks?: Array<{
      lines?: Array<{ text?: string }>;
    }>;
  };
}

interface OcrV32Response {
  regions?: Array<{
    lines?: Array<{
      words?: Array<{ text?: string }>;
    }>;
  }>;
}

function textFromImageAnalysis(data: ImageAnalysisReadResponse): string {
  const lines: string[] = [];
  for (const block of data.readResult?.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const t = (line.text || "").trim();
      if (t) lines.push(t);
    }
  }
  return lines.join("\n").trim();
}

function textFromOcrV32(data: OcrV32Response): string {
  const lines: string[] = [];
  for (const region of data.regions ?? []) {
    for (const line of region.lines ?? []) {
      const words = (line.words ?? [])
        .map((w) => (w.text || "").trim())
        .filter(Boolean);
      if (words.length) lines.push(words.join(" "));
    }
  }
  return lines.join("\n").trim();
}

/** Returns extracted text, or `null` if the API version is not supported on this resource. */
async function analyzeReadV4(
  config: AzureVisionConfig,
  bytes: Buffer
): Promise<string | null> {
  const url =
    `${config.endpoint}/computervision/imageanalysis:analyze` +
    `?api-version=2024-02-01&features=read`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });

  if (res.status === 404 || res.status === 405) {
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Azure Vision Read failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const data = (await res.json()) as ImageAnalysisReadResponse;
  return textFromImageAnalysis(data);
}

async function analyzeOcrV32(
  config: AzureVisionConfig,
  bytes: Buffer
): Promise<string> {
  const url = `${config.endpoint}/vision/v3.2/ocr?language=unk&detectOrientation=true`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Azure Vision OCR failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const data = (await res.json()) as OcrV32Response;
  return textFromOcrV32(data);
}

/**
 * Extract plain text from a receipt/photo (base64 or data URL).
 * Prefers Image Analysis 4.0 Read; falls back to OCR v3.2.
 */
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const config = getVisionConfig();
  if (!config) {
    throw new Error("Azure Vision is not configured");
  }

  const bytes = stripDataUrl(imageBase64);
  if (!bytes.byteLength) {
    throw new Error("Empty image");
  }

  let text = "";

  try {
    const v4 = await analyzeReadV4(config, bytes);
    if (v4 !== null && v4.trim()) {
      text = v4.trim();
    } else if (v4 !== null) {
      // v4 available but empty — still try v3.2 before failing
      text = (await analyzeOcrV32(config, bytes)).trim();
    } else {
      text = (await analyzeOcrV32(config, bytes)).trim();
    }
  } catch (err) {
    // If v4 threw a hard error, attempt classic OCR once
    try {
      text = (await analyzeOcrV32(config, bytes)).trim();
    } catch {
      throw err;
    }
  }

  if (!text) {
    throw new Error("NO_TEXT");
  }
  return text;
}

import type { GeminiThinkingDepth } from "../types";

export interface EncodeResponse {
  vectorB: number[];
  model: string;
}

export interface DecodeResponse {
  summary: string;
  article: string;
  deepReasoningNotes: string;
  model: string;
  thinkingDepth: GeminiThinkingDepth;
}

export interface MathExplainResponse {
  explanation: string;
  model: string;
  thinkingDepth: GeminiThinkingDepth;
}

async function safeFetch(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "تعذر الاتصال بخادم التطبيق مؤقتاً. يرجى المحاولة مرة أخرى بعد لحظة."
    );
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await safeFetch(url, body);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `فشل الطلب إلى الخادم (${response.status})`);
  }
  return data as T;
}

async function postNdjsonStream<T>(
  url: string,
  body: unknown,
  onChunk?: (text: string) => void
): Promise<T> {
  const response = await safeFetch(url, body);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `فشل الطلب إلى الخادم (${response.status})`);
  }

  if (!response.body) {
    throw new Error("استجابة الخادم فارغة.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: T | null = null;
  let streamError: Error | null = null;

  const processLine = (line: string) => {
    if (!line) return;
    let event: {
      type: "ping" | "chunk" | "result" | "error";
      text?: string;
      data?: T;
      error?: string;
    };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.type === "chunk" && event.text && onChunk) {
      onChunk(event.text);
    } else if (event.type === "error") {
      streamError = new Error(event.error || "حدث خطأ أثناء المعالجة في الخادم.");
    } else if (event.type === "result" && event.data) {
      finalResult = event.data;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        processLine(line);
        if (streamError) throw streamError;
        newlineIndex = buffer.indexOf("\n");
      }
    }

    if (buffer.trim()) {
      processLine(buffer.trim());
      if (streamError) throw streamError;
    }
  } catch (err) {
    if (finalResult) {
      return finalResult;
    }
    if (streamError) {
      throw streamError;
    }
    if (err instanceof Error && !/network|fetch|abort/i.test(err.message)) {
      throw err;
    }
    throw new Error(
      "انقطع الاتصال بالخادم أثناء استقبال البث. يرجى إعادة المحاولة."
    );
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore lock release errors
    }
  }

  if (!finalResult) {
    throw new Error("انتهى البث قبل اكتمال استجابة Gemini 4. يرجى إعادة المحاولة.");
  }
  return finalResult;
}

export const encodeProblemToVector = async (
  problemText: string
): Promise<EncodeResponse> => {
  return postJson<EncodeResponse>("/api/gemini/encode", { problemText });
};

export const decodeSolution = async (
  originalProblem: string,
  vectorX: number[],
  vectorB: number[],
  options?: {
    subsetDetails?: unknown;
    satDetails?: unknown;
    spectral?: {
      singularValues: number[];
      conditionNumber: number;
      orthogonalityDefect: number;
    };
    integralityGap?: number;
    thinkingDepth?: GeminiThinkingDepth;
  }
): Promise<DecodeResponse> => {
  return postNdjsonStream<DecodeResponse>("/api/gemini/decode", {
    originalProblem,
    vectorX,
    vectorB,
    subsetDetails: options?.subsetDetails,
    satDetails: options?.satDetails,
    spectral: options?.spectral,
    integralityGap: options?.integralityGap,
    thinkingDepth: options?.thinkingDepth || "XHIGH",
  });
};

export const askGeminiDeepMath = async (
  question: string,
  thinkingDepth: GeminiThinkingDepth = "XHIGH",
  onChunk?: (text: string) => void
): Promise<MathExplainResponse> => {
  return postNdjsonStream<MathExplainResponse>(
    "/api/gemini/explain-math",
    {
      question,
      thinkingDepth,
    },
    onChunk
  );
};
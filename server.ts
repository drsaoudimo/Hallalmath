import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type GenerateContentResponse,
} from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_FREE_DEEP_MODEL = "gemini-4-hydrogen";
const GEMINI_FREE_LITE_FALLBACK = "gemini-3.1-flash-lite";

const isRateLimitError = (error: unknown): boolean => {
  const err = error as { status?: number; code?: number; message?: string };
  const msg = err?.message || "";
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
};

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const resolveThinkingLevel = (depth?: string): ThinkingLevel => {
  switch (depth) {
    case "LOW":
      return ThinkingLevel.LOW;
    case "MEDIUM":
      return ThinkingLevel.MEDIUM;
    case "HIGH":
      return ThinkingLevel.HIGH;
    case "XHIGH":
    default:
      return ThinkingLevel.XHIGH;
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 1,
  baseDelay = 1200
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (retries > 0 && isRateLimitError(error)) {
      const delay = baseDelay * (1 + Math.random() * 0.3);
      await wait(delay);
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const mapGeminiError = (error: unknown): { status: number; message: string } => {
  const err = error as { status?: number; code?: number; message?: string };
  const status = Number(err?.status || err?.code) || 500;
  const rawMessage = err?.message || "حدث خطأ غير متوقع أثناء الاتصال بنموذج Gemini 4.";

  if (
    status === 403 ||
    status === 400 ||
    rawMessage.includes("PERMISSION_DENIED") ||
    rawMessage.includes("API_KEY_INVALID")
  ) {
    return {
      status: status === 403 ? 403 : 400,
      message:
        "تعذر التحقق من مفتاح Gemini API. يرجى التأكد من إعداد GEMINI_API_KEY في لوحة Settings > Secrets.",
    };
  }

  if (isRateLimitError(error)) {
    return {
      status: 429,
      message:
        "تم بلوغ حد الحصة المؤقتة للمستوى المجاني (429). يرجى الانتظار قليلاً ثم إعادة المحاولة، أو استخدام مفتاح API مفعّل للفوترة من Settings > Secrets لزيادة الحصة.",
    };
  }

  if (status === 404 || rawMessage.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `النموذج المطلوب (${GEMINI_FREE_DEEP_MODEL}) غير متاح حالياً.`,
    };
  }

  return { status: 500, message: rawMessage };
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      model: GEMINI_FREE_DEEP_MODEL,
      thinkingSupport: ["LOW", "MEDIUM", "HIGH", "XHIGH"],
    });
  });

  // 1. Encode problem statement into 19-dim constraint vector b
  app.post("/api/gemini/encode", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "مفتاح GEMINI_API_KEY غير مضبوط على الخادم. يرجى إضافته في لوحة Settings > Secrets.",
      });
      return;
    }

    const { problemText } = req.body as { problemText?: string };
    if (!problemText || typeof problemText !== "string" || !problemText.trim()) {
      res.status(400).json({ error: "نص المسألة مطلوب للترميز." });
      return;
    }

    const condensedProblem =
      problemText.length > 1800
        ? `${problemText.slice(0, 1200)}\n... [تم اختصار بقية النص للترميز الشعاعي السريع، الطول الكلي: ${problemText.length} حرف]`
        : problemText;

    try {
      let activeModel = GEMINI_FREE_DEEP_MODEL;
      let response: GenerateContentResponse;
      try {
        response = await retryWithBackoff(() =>
          ai.models.generateContent({
            model: GEMINI_FREE_DEEP_MODEL,
            contents: `أنت مرمز رياضي لنظام "حلال المصفوفات الكمومي".
قم بتحليل المشكلة التالية وقم بترميزها في متجه قيود مكون من 19 عددًا صحيحًا (b vector) لنظام خطي Ax = b حيث A مصفوفة أبعادها 19x6.
إذا كان السؤال نصيًا أو نظريًا (فيزياء، منطق، رياضيات) أو صيغة CNF/SAT، فحوّل شدة القيود البنيوية وكثافة الجمل في السؤال إلى قيم صحيحة متناسبة بين 0 و 1000.

المشكلة: "${condensedProblem}"

أرجع فقط مصفوفة JSON تحتوي على 19 رقمًا صحيحًا (0-1000).`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
          })
        );
      } catch (primaryErr) {
        if (!isRateLimitError(primaryErr)) throw primaryErr;
        activeModel = GEMINI_FREE_LITE_FALLBACK;
        response = await ai.models.generateContent({
          model: GEMINI_FREE_LITE_FALLBACK,
          contents: `أنت مرمز رياضي لنظام "حلال المصفوفات الكمومي".
قم بتحليل المشكلة التالية وقم بترميزها في متجه قيود مكون من 19 عددًا صحيحًا (b vector) لنظام خطي Ax = b.
المشكلة: "${condensedProblem}"
أرجع فقط مصفوفة JSON تحتوي على 19 رقمًا صحيحًا (0-1000).`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
          },
        });
      }

      const json = JSON.parse(response.text || "[]");
      if (!Array.isArray(json) || json.length < 19) {
        res.status(502).json({
          error: "أعاد النموذج صيغة متجه غير مكتملة (أقل من 19 بُعداً).",
        });
        return;
      }

      res.json({
        vectorB: json
          .slice(0, 19)
          .map((n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)))),
        model: activeModel,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 2. Decode solution with Gemini 4 Hydrogen Deep Thinking (NDJSON streaming + keepalive)
  app.post("/api/gemini/decode", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "مفتاح GEMINI_API_KEY غير مضبوط على الخادم. يرجى إضافته في لوحة Settings > Secrets.",
      });
      return;
    }

    const {
      originalProblem,
      vectorX,
      vectorB,
      subsetDetails,
      satDetails,
      spectral,
      integralityGap,
      thinkingDepth = "XHIGH",
    } = req.body as {
      originalProblem?: string;
      vectorX?: number[];
      vectorB?: number[];
      subsetDetails?: {
        isSubsetSum?: boolean;
        status?: string;
        target?: string;
        achievedSum?: string;
        residual?: string;
        foundSubset?: string[];
        solveMethod?: string;
        solveTimeMs?: number;
      };
      satDetails?: {
        isSatProblem?: boolean;
        nVars?: number;
        nClauses?: number;
        satisfiedClauses?: number;
        status?: string;
        trueVars?: number[];
        falseVars?: number[];
        solveMethod?: string;
        solveTimeMs?: number;
      };
      spectral?: {
        singularValues?: number[];
        conditionNumber?: number;
        orthogonalityDefect?: number;
      };
      integralityGap?: number;
      thinkingDepth?: string;
    };

    if (!originalProblem || !Array.isArray(vectorX) || !Array.isArray(vectorB)) {
      res.status(400).json({ error: "بيانات المسألة أو متجه الحل غير مكتملة." });
      return;
    }

    const thinkingLevel = resolveThinkingLevel(thinkingDepth);

    let contextSpecificPrompt = "";
    if (satDetails && satDetails.isSatProblem) {
      const ratio =
        satDetails.nVars && satDetails.nClauses
          ? (satDetails.nClauses / satDetails.nVars).toFixed(2)
          : "N/A";
      contextSpecificPrompt = `
**السياق: مسألة إرضاء منطقي 3-SAT بصيغة DIMACS CNF.**
البيانات المحسوبة والمُتحقق منها فعلياً:
- الحالة: ${satDetails.status}
- عدد المتغيرات: ${satDetails.nVars}
- عدد الشروط (Clauses): ${satDetails.nClauses} (نسبة الجمل/المتغيرات α = ${ratio})
- الشروط المحققة فعلياً: ${satDetails.satisfiedClauses} من ${satDetails.nClauses}
- الخوارزمية المستخدمة: ${satDetails.solveMethod} (الزمن: ${satDetails.solveTimeMs} مللي ثانية)
- المتغيرات الصحيحة (True): ${(satDetails.trueVars || []).length} — أمثلة: ${(satDetails.trueVars || []).slice(0, 25).join(", ")}
- المتغيرات الخاطئة (False): ${(satDetails.falseVars || []).length} — أمثلة: ${(satDetails.falseVars || []).slice(0, 25).join(", ")}

المطلوب: التزم تماماً بهذه الأرقام الحقيقية دون أي تعديل. قدّم في directAnswer خلاصة حرفية دقيقة لنتيجة حل 3-SAT وعدد الشروط المحققة (${satDetails.satisfiedClauses}/${satDetails.nClauses}) وتوزيع المتغيرات، واشرح في المقال العلمي كيف تعامل المحرك مع نقطة التحول الطوري (α ≈ ${ratio}) عبر الاسترخاء المستمر لمصفوفة الوقوع ثم WalkSAT وخوارزمية CDCL.`;
    } else if (subsetDetails && subsetDetails.isSubsetSum) {
      contextSpecificPrompt = `
**السياق: مسألة Subset Sum بدقة الأعداد الصحيحة الكبيرة (BigInt).**
البيانات المحسوبة والمُتحقق منها فعلياً:
- الحالة: ${subsetDetails.status}
- الخوارزمية: ${subsetDetails.solveMethod || "Exact BigInt Solver"} (${subsetDetails.solveTimeMs ?? "?"} مللي ثانية)
- الهدف (Target): ${subsetDetails.target}
- المجموع المحقق فعلياً: ${subsetDetails.achievedSum ?? subsetDetails.target}
- المتبقي (Residual): ${subsetDetails.residual}
- العناصر المختارة حرفياً (${(subsetDetails.foundSubset || []).length} عناصر): [${(subsetDetails.foundSubset || []).join(", ")}]

المطلوب: التزم حرفياً بهذه الأرقام والمعادلة الدقيقة (${(subsetDetails.foundSubset || []).join(" + ")} = ${subsetDetails.achievedSum ?? subsetDetails.target}). اذكر الحل الحرفي الدقيق في directAnswer، واشرح في التقرير آلية الوصول إليه بدقة BigInt.`;
    } else {
      contextSpecificPrompt = `
**السياق: مسألة رياضية / منطقية / فيزيائية / خوارزمية عامة.**
النص الكامل لمسألة المستخدم:
"""
${originalProblem.slice(0, 8000)}
"""

بيانات المحاكاة المصفوفية المرافقة (19×6):
- متجه القيود المستخرج b (أول 10 قيم): [${vectorB.slice(0, 10).join(", ")}...]
- المتجه الثنائي الأمثل في فضاء {0,1}⁶: [${vectorX.join(", ")}]
- الفجوة التكاملية (Integrality Gap): ${typeof integralityGap === "number" ? integralityGap.toFixed(4) : "N/A"}

تعليمات حاسمة للدقة الحرفية:
1. في الحقل (directAnswer): قدّم **الحل الحرفي المباشر والكامل والأدق** لمسألة المستخدم حرفياً كما طُلبت:
   - إذا كانت مسألة جبرية أو معادلات أو حساباً عددياً أو تحليلاً أو منطقاً: اعرض خطوات الحل الصارمة والنتيجة النهائية الحرفية الدقيقة مع التحقق بالتعويض.
   - إذا كانت مسألة نظرية أو خوارزمية أو فيزيائية (أو تتضمن فرضية مستحيلة رياضياً مثل كسر تعقيد خوارزمية على عتاد غير متوافق): قدّم الحقيقة الرياضية الدقيقة والبرهان الواضح والصيغة الصحيحة بدقة علمية تامة.
   - لا تخلط directAnswer بتفسيرات مجازية عن متجه الـ 6 بت [${vectorX.join(", ")}]؛ اجعل directAnswer إجابةً علميةً حرفيةً خالصةً للمسألة ذاتها.
2. في الحقل (scientificArticle): ابدأ بـ "1. الحل الرياضي الحرفي الكامل والتحقق من صحته" متبوعاً بالتحليل الطيفي وهندسة الشبكات LLL ومنهجية A-guided Heuristic للمحاكاة المصفوفية المرافقة، مع التمييز الصارم بين الحل الحرفي للمسألة والتمثيل المصفوفي.`;
    }

    const spectralContext = spectral
      ? `\nبيانات التحليل الطيفي الفعلية:\n- رقم الشرط (Condition Number): ${spectral.conditionNumber?.toFixed(2)}\n- عيب التعامد (Orthogonality Defect): ${spectral.orthogonalityDefect?.toFixed(3)}\n- القيم المنفردة (Singular Values): [${(spectral.singularValues || []).map((v) => v.toFixed(2)).join(", ")}]`
      : "";

    const prompt = `أنت عالم رياضيات تطبيقية وفيزياء نظرية متخصص في الإثبات الرياضي الدقيق والنمذجة المصفوفية وهندسة الشبكات.

المهمة: الوصول إلى الحل الحرفي والأدق لمسألة المستخدم وتقديم التحليل العلمي المرافق.

${contextSpecificPrompt}
${spectralContext}

يجب أن يتضمن التقرير العلمي (scientificArticle) الأقسام التالية بأسلوب أكاديمي عربي رصين ومعادلات واضحة:
1. **الحل الحرفي والتحقق الرياضي الكامل (Exact Solution & Verification)**: برهان أو خطوات الحل المباشر للمسألة بدقة تامة.
2. **التحليل الطيفي (Spectral Analysis)**: مناقشة القيم المنفردة الفعلية ورقم الشرط والاتجاهات الصلبة (Stiff Directions) والمرنة (Sloppy Directions).
3. **هندسة الشبكات واختزال LLL (Lattice Geometry)**: تفسير البحث عن أقصر متجه وتقليل عيب التعامد عبر غرام-شميدت وشرط Lovász.
4. **استراتيجية المحاكاة (A-guided Heuristic) والنتائج المثبتة مقابل التفسير**: التمييز الصارم بين الحل الحرفي المثبت جبرياً للمسألة وبين التفسير التمثيلي في الفضاء 19×6.

كما أنشئ حقلاً مختصراً (deepReasoningNotes) يلخص أهم خطوات الاستدلال والتحقق الحرفي في 3 إلى 4 نقاط مركزة.`;

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`${JSON.stringify({ type: "ping" })}\n`);

    let closed = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        closed = true;
      }
    });

    const keepalive = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write(`${JSON.stringify({ type: "ping" })}\n`);
      }
    }, 3000);

    try {
      let activeModel = GEMINI_FREE_DEEP_MODEL;
      let stream;
      try {
        stream = await retryWithBackoff(() =>
          ai.models.generateContentStream({
            model: GEMINI_FREE_DEEP_MODEL,
            contents: prompt,
            config: {
              systemInstruction:
                "أنت باحث رياضي دقيق يستخدم اللغة العربية الأكاديمية الواضحة ويلتزم تماماً بالبيانات العددية المعطاة دون اختلاق أرقام متناقضة.",
              thinkingConfig: { thinkingLevel },
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  directAnswer: { type: Type.STRING },
                  deepReasoningNotes: { type: Type.STRING },
                  scientificArticle: { type: Type.STRING },
                },
                required: ["directAnswer", "deepReasoningNotes", "scientificArticle"],
              },
            },
          })
        );
      } catch (primaryErr) {
        if (!isRateLimitError(primaryErr)) throw primaryErr;
        activeModel = GEMINI_FREE_LITE_FALLBACK;
        stream = await ai.models.generateContentStream({
          model: GEMINI_FREE_LITE_FALLBACK,
          contents: prompt,
          config: {
            systemInstruction:
              "أنت باحث رياضي دقيق يستخدم اللغة العربية الأكاديمية الواضحة ويلتزم تماماً بالبيانات العددية المعطاة دون اختلاق أرقام متناقضة.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                directAnswer: { type: Type.STRING },
                deepReasoningNotes: { type: Type.STRING },
                scientificArticle: { type: Type.STRING },
              },
              required: ["directAnswer", "deepReasoningNotes", "scientificArticle"],
            },
          },
        });
      }

      let fullText = "";
      for await (const chunk of stream) {
        if (closed) break;
        if (chunk.text) {
          fullText += chunk.text;
        }
      }

      if (!closed && !res.writableEnded) {
        const parsed = JSON.parse(fullText || "{}");
        res.write(
          `${JSON.stringify({
            type: "result",
            data: {
              summary: parsed.directAnswer || "لم يتم توليد إجابة مباشرة.",
              deepReasoningNotes: parsed.deepReasoningNotes || "",
              article: parsed.scientificArticle || "لم يتم توليد التقرير العلمي.",
              model: activeModel,
              thinkingDepth,
            },
          })}\n`
        );
      }
    } catch (error) {
      console.error("Gemini decode stream error:", error);
      if (!closed && !res.writableEnded) {
        const mapped = mapGeminiError(error);
        res.write(
          `${JSON.stringify({
            type: "error",
            status: mapped.status,
            error: mapped.message,
          })}\n`
        );
      }
    } finally {
      clearInterval(keepalive);
      if (!closed && !res.writableEnded) {
        res.end();
      }
    }
  });

  // 3. Interactive Deep Mathematical Q&A (NDJSON streaming + keepalive)
  app.post("/api/gemini/explain-math", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "مفتاح GEMINI_API_KEY غير مضبوط على الخادم. يرجى إضافته في لوحة Settings > Secrets.",
      });
      return;
    }

    const { question, thinkingDepth = "XHIGH" } = req.body as {
      question?: string;
      thinkingDepth?: string;
    };

    if (!question || typeof question !== "string" || !question.trim()) {
      res.status(400).json({ error: "يرجى كتابة السؤال الرياضي أولاً." });
      return;
    }

    const thinkingLevel = resolveThinkingLevel(thinkingDepth);

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`${JSON.stringify({ type: "ping" })}\n`);

    let closed = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        closed = true;
      }
    });

    const keepalive = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write(`${JSON.stringify({ type: "ping" })}\n`);
      }
    }, 3000);

    try {
      const mathPrompt = `أنت أستاذ في الرياضيات التطبيقية والنمذجة المصفوفية.
يشغّل هذا التطبيق منهجية "A-guided Heuristic" للاستدلال الرياضي المكونة من:
- مصفوفة قيود A1 (19x6) ومصفوفة تصحيح بنيوي A_NT (19x6) ومتجه قيود b (19x1)
- موتر المقياس الموزون G (19x19) المشتق من M_corrected مع تنظيم Tikhonov: x = (A^T G A + λ I)^(-1) A^T G b وتحديث G_ii تكرارياً
- التحليل الطيفي للقيم المنفردة via Jacobi rotations على A^T A وحساب Condition Number و Orthogonality Defect
- اختزال شبكات LLL بمعامل δ = 0.99 عبر متعامدات Gram-Schmidt وشرط Lovász
- التثبيت (Anchoring) عند العتبات [0.15, 0.85] ثم البحث المحلي Bit-Flip (ومسار BigInt Subset Sum و 3-SAT عبر WalkSAT + CDCL)

سؤال المستخدم:
"${question}"

قدم شرحاً رياضياً مفصلاً ودقيقاً باللغة العربية مع الخطوات والاشتقاقات المعنية بشكل واضح ومنظم.`;

      let activeModel = GEMINI_FREE_DEEP_MODEL;
      let stream;
      try {
        stream = await retryWithBackoff(() =>
          ai.models.generateContentStream({
            model: GEMINI_FREE_DEEP_MODEL,
            contents: mathPrompt,
            config: {
              thinkingConfig: { thinkingLevel },
            },
          })
        );
      } catch (primaryErr) {
        if (!isRateLimitError(primaryErr)) throw primaryErr;
        activeModel = GEMINI_FREE_LITE_FALLBACK;
        stream = await ai.models.generateContentStream({
          model: GEMINI_FREE_LITE_FALLBACK,
          contents: mathPrompt,
        });
      }

      let explanation = "";
      for await (const chunk of stream) {
        if (closed) break;
        if (chunk.text) {
          explanation += chunk.text;
          res.write(
            `${JSON.stringify({ type: "chunk", text: chunk.text })}\n`
          );
        }
      }

      if (!closed && !res.writableEnded) {
        res.write(
          `${JSON.stringify({
            type: "result",
            data: {
              explanation: explanation || "لم يتم توليد شرح.",
              model: activeModel,
              thinkingDepth,
            },
          })}\n`
        );
      }
    } catch (error) {
      console.error("Gemini explain-math stream error:", error);
      if (!closed && !res.writableEnded) {
        const mapped = mapGeminiError(error);
        res.write(
          `${JSON.stringify({
            type: "error",
            status: mapped.status,
            error: mapped.message,
          })}\n`
        );
      }
    } finally {
      clearInterval(keepalive);
      if (!closed && !res.writableEnded) {
        res.end();
      }
    }
  });

  // Vite middleware in dev, static serving in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Quantum Matrix Solver server listening on http://0.0.0.0:${PORT} (Model: ${GEMINI_FREE_DEEP_MODEL})`
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

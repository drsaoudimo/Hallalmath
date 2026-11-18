import React, { useState } from 'react';
import { BookOpen, Sparkles, Sigma, Layers, GitBranch, Cpu, Send, Loader2, AlertCircle } from 'lucide-react';
import { askGeminiDeepMath } from '../services/geminiService';
import type { GeminiThinkingDepth } from '../types';

interface MathMethodologyPanelProps {
  thinkingDepth: GeminiThinkingDepth;
}

const MATH_SECTIONS = [
  {
    number: '1',
    title: 'التمثيل المصفوفي وصياغة نظام القيود (Matrix Encoding & Ax = b)',
    icon: Sigma,
    accent: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
    formula: 'A₁ x = b ,   A₁ ∈ ℝ¹⁹ˣ⁶ ,   x ∈ {0, 1}⁶ ,   b ∈ ℤ¹⁹',
    summary:
      'تُحوَّل المسألة الرياضية أو الفيزيائية إلى نظام خطي مُقيَّد عالي البُعد؛ حيث يمثل المتجه b ∈ [0, 1000]¹⁹ شدة القيود البنيوية المستخلصة، بينما تمثل أعمدة المصفوفة A₁ المتغيرات الأساسية المستقلة للنظام، وتعمل المصفوفة A_NT ∈ ℝ¹⁹ˣ⁶ كمعامل تصحيح بنيوي (Non-Trivial Structural Correction).',
    bullets: [
      'بُعد القيود m = 19 أكبر من بُعد المتغيرات n = 6 (نظام فائض التحديد Overdetermined System)، مما يمنع وجود حل صفري تافه ويفرض إيجاد أقرب نقطة مستقرة.',
      'تُختَزل الفرضيات الممكنة في الفضاء الثنائي {0, 1}⁶ (أي 2⁶ = 64 تكوين حالة أساسي)، أو {0, 1}ⁿ باستخدام أعداد صحيحة كبيرة (BigInt) في وضع Subset Sum.',
    ],
  },
  {
    number: '2',
    title: 'الاسترخاء المستمر وموتر المقياس الموزون (Continuous Relaxation & Metric Tensor)',
    icon: Layers,
    accent: 'text-purple-400 border-purple-500/30 bg-purple-950/20',
    formula: 'x⁽ᵗ⁺¹⁾ = (Aᵀ G⁽ᵗ⁾ A + λI)⁻¹ Aᵀ G⁽ᵗ⁾ b ,   Gᵢᵢ⁽ᵗ⁺¹⁾ = Gᵢᵢ⁽ᵗ⁾ · (1 + |rᵢ|/1000)',
    summary:
      'بدلاً من البحث التوافقي المكلف أسياً، يتم استرخاء القيد الثنائي إلى الفضاء الحقيقي المستمر ℝ⁶ عبر تقليل دالة خسارة موزونة بموتر المقياس القطري G ∈ ℝ¹⁹ˣ¹⁹ (المشتق من M_corrected) مع تنظيم تيخونوف (Tikhonov Regularization) بمعامل λ = 0.5 لمنع تفرد المصفوفة.',
    bullets: [
      'دالة الهدف: L(x) = (Ax - b)ᵀ G (Ax - b) + λ‖x‖₂²، وبمساواة التدرج بالصفر ∇ₓL(x) = 0 نحصل على المعادلات الطبيعية المنظمة.',
      'التحديث التكراري للمقياس (Iterative Reweighting): عند كل خطوة، يُحسب المتبقي rᵢ = (Ax)ᵢ - bᵢ وتُضاعَف أوزان الصفوف ذات الخطأ الأكبر لإجبار الحل على احترام القيود الحرجة.',
      'التصحيح البنيوي: يُضاف انزياح صغير معاير من متوسط أعمدة A_NT بنسبة 0.01 لضبط التوازن الهندسي قبل التكميم.',
    ],
  },
  {
    number: '3',
    title: 'التحليل الطيفي وصلابة الاتجاهات (Spectral Analysis & Jacobi SVD)',
    icon: Cpu,
    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
    formula: 'σᵢ = √(λᵢ(AᵀA)) ,   κ(A) = σ_max / σ_min',
    summary:
      'يُحلَّل طيف المصفوفة عبر حساب القيم المنفردة لمصفوفة غرام المتماثلة (AᵀA) باستخدام خوارزمية دورانات جاكوبي المتعامدة (Jacobi Eigenvalue Rotations)، لتصنيف حساسية الحل تجاه الاضطرابات.',
    bullets: [
      'الاتجاهات الصلبة (Stiff Directions): القيم المنفردة الكبيرة (σᵢ ≫ 1) تمثل قيوداً صارمة لا تسمح بانحراف المتغيرات دون قفزة كبيرة في الخطأ.',
      'الاتجاهات المرنة (Sloppy Directions): القيم المنفردة الصغيرة تمثل درجات حرية تسمح بتعديلات محلية للوصول إلى أقرب نقطة شبكة ثنائية.',
      'رقم الشرط κ(A): يقيس نسبة التضخيم القصوى للخطأ العددي ويحدد استقرار عملية عكس المصفوفة.',
    ],
  },
  {
    number: '4',
    title: 'هندسة الشبكات واختزال LLL (Lattice Geometry & LLL Reduction)',
    icon: GitBranch,
    accent: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
    formula: '‖bₖ*‖² ≥ (δ - μ²ₖ,ₖ₋₁) ‖bₖ₋₁*‖² ,   δ = 0.99 ,   Defect = Π‖bᵢ‖ / det(Λ)',
    summary:
      'تُعامل أعمدة المصفوفة A كأساس لشبكة إقليدية Λ ⊂ ℝ¹⁹. تقوم خوارزمية Lenstra–Lenstra–Lovász (LLL) بتحويل الأساس الأصلي شديد التداخل إلى أساس شبه متعامد ذي متجهات أقصر دون تغيير الشبكة.',
    bullets: [
      'تُحسب متجهات غرام-شميدت المتعامدة bᵢ* ومعاملات الإسقاط μᵢ,ⱼ = ⟨bᵢ, bⱼ*⟩ / ‖bⱼ*‖².',
      'اختزال الحجم (Size Reduction): يضمن أن |μₖ,ⱼ| ≤ 0.5 بطرح مضاعفات صحيحة من المتجهات السابقة.',
      'شرط لوفاش (Lovász Condition): يبدّل المتجهين المتجاورين عند الإخلال بالعتبة δ = 0.99، مما يخفض عيب التعامد (Orthogonality Defect) ويُحسّن تقريب أقصر متجه.',
    ],
  },
  {
    number: '5',
    title: 'استراتيجية A-guided Heuristic والتنقيح الثنائي ومسار BigInt',
    icon: BookOpen,
    accent: 'text-sky-400 border-sky-500/30 bg-sky-950/20',
    formula: 'Anchoring: xᵢ ≥ 0.85 → 1, xᵢ ≤ 0.15 → 0  |  Δ_int = (1/n) Σ |xᵢᶜᵒⁿᵗ - xᵢᵇⁱⁿ|',
    summary:
      'تُحوَّل القيم المستمرة إلى حل ثنائي دقيق عبر خطوتين: التثبيت عالي الثقة (Anchoring) للمتغيرات الواضحة، ثم البحث المحلي بقلب البتات (Bit-Flip Local Search) على المتغيرات الملتبسة فقط لتقليص فضاء البحث.',
    bullets: [
      'في وضع Subset Sum للأعداد الكبيرة (BigInt): تُطبّع العناصر بالنسبة لأكبر عنصر، ثم يُنفَّذ نزول تدرجي (Gradient Descent) على (A_norm · x - T_norm)² لـ 200 تكرار، يليه تثبيت وتقريب احتمالي، ثم تسلق تل عشوائي (Stochastic Hill Climbing) بدقة BigInt تامة لتصغير الباقي |Σ aᵢxᵢ - T| إلى الصفر.',
      'الفجوة التكاملية (Integrality Gap): تقيس متوسط المسافة بين الحل المستمر المثالي والحل الثنائي النهائي؛ كلما اقتربت من الصفر زادت موثوقية التقارب.',
    ],
  },
  {
    number: '6',
    title: 'الاستدلال العميق عبر Gemini 4 Hydrogen (مجاني • XHIGH)',
    icon: Sparkles,
    accent: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-950/20',
    formula: 'Model: gemini-4-hydrogen  |  ThinkingLevel: XHIGH (Deep Reasoning)',
    summary:
      'يدمج المحرك نموذج Gemini 4 Hydrogen المجاني على الخادم مع تفعيل مستوى التفكير العميق (ThinkingLevel.XHIGH) للربط بين الترميز الشعاعي الأولي (Encoding) وبين الصياغة البرهانية والتحليل الطيفي للنتائج النهائية دون فرض قيود نماذج مدفوعة.',
    bullets: [
      'تنفيذ جميع استدعاءات Gemini 4 عبر واجهات خادم محمية (/api/gemini/*) لضمان الاعتمادية والخصوصية.',
      'استخدام ThinkingLevel.XHIGH في التفكيك والتحليل الرياضي لتوليد اشتقاقات متماسكة وتمييز النتائج المثبتة جبرياً عن الاستنتاجات الفيزيائية.',
    ],
  },
];

const SUGGESTED_QUESTIONS = [
  'كيف يضمن تنظيم تيخونوف (λI) استقرار المصفوفة عند عكسها وما أثر تغيير λ؟',
  'اشرح العلاقة بين رقم الشرط κ(A) والاتجاهات الصلبة والمرنة في التحليل الطيفي.',
  'لماذا تفشل خوارزميات الفواصل العائمة مع Subset Sum وكيف يعالجها مسار BigInt؟',
];

export const MathMethodologyPanel: React.FC<MathMethodologyPanelProps> = ({ thinkingDepth }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (promptText?: string) => {
    const q = (promptText ?? question).trim();
    if (!q || loading) return;
    if (promptText) setQuestion(promptText);
    setLoading(true);
    setError(null);
    setAnswer('');
    try {
      const res = await askGeminiDeepMath(q, thinkingDepth, (chunk) => {
        setAnswer((prev) => (prev ?? '') + chunk);
      });
      setAnswer(res.explanation);
    } catch (err) {
      setAnswer((prev) => (prev && prev.trim() ? prev : null));
      setError(err instanceof Error ? err.message : 'تعذر الحصول على رد من Gemini 4 العميق.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Intro Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900/95 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-3">
            <Sigma className="w-6 h-6 text-cyan-400" />
            الشرح الرياضي المفصل لمنهجية النمذجة المصفوفية للاستدلال الرياضي
          </h2>
          <span className="text-xs px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 font-semibold">
            A-guided Heuristic • المرجع الرياضي الكامل
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          توضح البنود الستة التالية البنية الجبرية والهندسية الكاملة التي يعتمد عليها المحرك لمحاكاة الاستدلال الكمومي على العتاد التقليدي، بدءاً من الترميز الشعاعي وصولاً إلى التنقيح الثنائي والتحليل العميق عبر Gemini 4 Hydrogen.
        </p>
      </div>

      {/* 6 Mathematical Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {MATH_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <section
              key={sec.number}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${sec.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-0.5">البند {sec.number}</div>
                  <h3 className="text-base font-bold text-slate-100 leading-snug">{sec.title}</h3>
                </div>
              </div>

              <div
                dir="ltr"
                className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto text-center"
              >
                {sec.formula}
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{sec.summary}</p>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                {sec.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Interactive Gemini 4 Deep Mathematical Q&A */}
      <div className="bg-slate-900/85 border border-purple-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">
              اسأل Gemini 4 العميق (gemini-4-hydrogen) عن أي اشتقاق رياضي
            </h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-purple-500/15 border border-purple-400/30 text-purple-300 font-mono">
            ThinkingLevel: {thinkingDepth}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(q)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-purple-200 transition-colors text-right disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAsk();
            }}
            placeholder="اطرح سؤالاً رياضياً معمقاً حول المصفوفات أو LLL أو التحليل الطيفي..."
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
          />
          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-l from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التفكير العميق...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                تحليل رياضي عميق
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {answer && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-sm text-slate-200 leading-loose whitespace-pre-wrap">
            {answer}
          </div>
        )}
      </div>
    </div>
  );
};

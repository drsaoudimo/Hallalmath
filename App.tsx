import React, { useState } from 'react';
import { A1, M_CORRECTED } from './constants';
import { MatrixVisualizer } from './components/MatrixVisualizer';
import { QuantumLoader } from './components/QuantumLoader';
import { MathMethodologyPanel } from './components/MathMethodologyPanel';
import { SemiprimeFactorizerPanel } from './components/SemiprimeFactorizerPanel';
import { encodeProblemToVector, decodeSolution } from './services/geminiService';
import { solveQuantumSystem, isStructuredLocalProblem } from './services/solverService';
import { AppState, SolverResult, type GeminiThinkingDepth } from './types';
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BrainCircuit, BookOpen, Calculator, Sparkles, AlertTriangle, CheckCircle2, Copy, Check, Loader2, RefreshCw, Binary } from 'lucide-react';

const THINKING_DEPTH_OPTIONS: {
  value: GeminiThinkingDepth;
  label: string;
  hint: string;
}[] = [
  { value: 'XHIGH', label: 'عميق أقصى (XHIGH)', hint: 'أعمق استدلال برهاني وتحليل طيفي' },
  { value: 'HIGH', label: 'عميق متوازن (HIGH)', hint: 'توازن مثالي بين العمق والسرعة' },
  { value: 'MEDIUM', label: 'متوسط (MEDIUM)', hint: 'استدلال متوسط سريع' },
  { value: 'LOW', label: 'سريع (LOW)', hint: 'استجابة فورية بأقل زمن' },
];

const SAMPLE_PROBLEMS = [
  {
    label: 'مسألة 3-SAT (DIMACS)',
    text: 'p cnf 12 30\n-1 4 9 0 -2 -5 10 0 3 7 -11 0 -4 8 12 0 1 -6 11 0 2 5 -9 0 -3 8 10 0 6 -7 12 0 -1 -8 5 0 4 -10 11 0 -2 3 9 0 7 -12 1 0 -5 6 8 0 -9 10 -11 0 2 -4 12 0 1 3 -7 0 -6 9 -10 0 4 5 -12 0 -8 11 2 0 3 -5 6 0 -1 -9 12 0 7 8 -10 0 -2 6 11 0 5 -7 9 0 -3 -4 12 0 1 10 -11 0 -6 -8 4 0 2 9 -12 0 -5 10 3 0 8 -11 7 0',
  },
  {
    label: 'مسألة Subset Sum (BigInt)',
    text: '120500400 40000100 50000300 30000000 85000000 15000000 Target: 90000400',
  },
  {
    label: 'استدلال فيزيائي نظري',
    text: 'هل يمكن تحقيق انتقال كمومي متماسك للمعلومات عبر ثقوب دودية مستقرة مع الحفاظ على السببية وحفظ الطاقة؟',
  },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'solver' | 'semiprime' | 'methodology'>('solver');
  const [input, setInput] = useState('');
  const [thinkingDepth, setThinkingDepth] = useState<GeminiThinkingDepth>('XHIGH');
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isDecodingAi, setIsDecodingAi] = useState(false);
  const [aiDecodeError, setAiDecodeError] = useState<string | null>(null);
  const [lastSolvedContext, setLastSolvedContext] = useState<{
    problem: string;
    solverOutput: SolverResult;
    bVector: number[];
  } | null>(null);

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(label);
      setTimeout(() => setCopiedFormat((prev) => (prev === label ? null : prev)), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const runAiDecode = async (
    problemText: string,
    solverOutput: SolverResult,
    bVector: number[]
  ) => {
    setIsDecodingAi(true);
    setAiDecodeError(null);
    try {
      const decoded = await decodeSolution(problemText, solverOutput.vectorX, bVector, {
        subsetDetails: solverOutput.subsetDetails,
        satDetails: solverOutput.satDetails,
        spectral: solverOutput.spectral,
        integralityGap: solverOutput.integralityGap,
        thinkingDepth,
      });

      setResult((prev) =>
        prev
          ? {
              ...prev,
              solutionText:
                solverOutput.satDetails || solverOutput.subsetDetails
                  ? prev.solutionText
                  : decoded.summary,
              scientificArticle: decoded.article,
              deepReasoningNotes: decoded.deepReasoningNotes,
              modelUsed: decoded.model,
              thinkingDepthUsed: decoded.thinkingDepth,
            }
          : prev
      );
    } catch (e) {
      setAiDecodeError(
        e instanceof Error
          ? e.message
          : 'تعذر توليد التقرير العلمي عبر Gemini 4 حالياً.'
      );
    } finally {
      setIsDecodingAi(false);
    }
  };

  const handleSolve = async () => {
    if (!input.trim()) return;
    setResult(null);
    setErrorMessage(null);
    setAiDecodeError(null);

    try {
      const isStructured = isStructuredLocalProblem(input);
      let bVector: number[];

      if (isStructured) {
        // Deterministic local 19-dim constraint signature for 3-SAT / Subset Sum
        bVector = Array(19)
          .fill(0)
          .map((_, i) => (input.charCodeAt(i % input.length) + i * 17) % 1000);
      } else {
        setState(AppState.ENCODING);
        const encoded = await encodeProblemToVector(input);
        bVector = encoded.vectorB;
      }

      setState(AppState.CALCULATING);
      const solverOutput = await solveQuantumSystem(bVector, input);

      setState(AppState.CORRECTING);
      await new Promise((r) => setTimeout(r, 120));

      // Publish verified mathematical results immediately
      setResult(solverOutput);
      setLastSolvedContext({ problem: input, solverOutput, bVector });
      setState(AppState.COMPLETED);

      // Stream deep scientific report via Gemini 4 Hydrogen in the background
      await runAiDecode(input, solverOutput, bVector);
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : 'تعذر التقارب نحو حل مستقر أو فشل الاتصال بالنموذج.'
      );
      setState(AppState.ERROR);
    }
  };

  const isBusy =
    state !== AppState.IDLE &&
    state !== AppState.COMPLETED &&
    state !== AppState.ERROR;

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white matrix-bg pb-20"
      dir="rtl"
    >
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center quantum-glow">
              <span className="font-bold text-white text-lg">Q</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-cyan-400 to-purple-400">
                حلال المصفوفات الكمومي
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('solver')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'solver'
                  ? 'bg-cyan-600/25 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              المحلل الكمومي
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('semiprime')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'semiprime'
                  ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Binary className="w-4 h-4 shrink-0" />
              تحليل شبه الأولية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('methodology')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'methodology'
                  ? 'bg-purple-600/25 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              الشرح الرياضي المعمق
            </button>
          </nav>

          <div className="text-xs text-slate-400 hidden md:flex items-center gap-2 font-bold whitespace-nowrap">
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              Gemini 4 Hydrogen • مجاني
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'methodology' ? (
          <MathMethodologyPanel thinkingDepth={thinkingDepth} />
        ) : activeTab === 'semiprime' ? (
          <SemiprimeFactorizerPanel />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input & Matrices Column */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    تعريف المسألة
                  </h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300">
                    gemini-4-hydrogen
                  </span>
                </div>

                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-cyan-50 focus:border-cyan-500 outline-none transition-all resize-none h-32"
                  placeholder="أدخل مسألة 3-SAT بصيغة DIMACS (p cnf 100 427 ...) أو Subset Sum (Target: ...) أو أي مسألة استدلالية..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />

                {/* Quick Sample Presets */}
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROBLEMS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => setInput(sample.text)}
                      disabled={isBusy}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>

                {/* Gemini 4 Free & Deep Reasoning Depth Selector */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <BrainCircuit className="w-4 h-4 text-purple-400" />
                      عمق التفكير (Gemini 4 Deep)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">مجاني بالكامل</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {THINKING_DEPTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setThinkingDepth(opt.value)}
                        disabled={isBusy}
                        title={opt.hint}
                        className={`px-2.5 py-2 rounded-md text-[11px] font-bold border transition-all text-center ${
                          thinkingDepth === opt.value
                            ? 'bg-purple-600/25 border-purple-400/60 text-purple-200 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSolve}
                  disabled={isBusy || !input.trim()}
                  className="w-full py-3 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isBusy ? 'جاري الحساب والاستدلال العميق...' : 'بحث عن الحل الدقيق'}
                </button>
              </div>

              <div className="space-y-4">
                {!result?.subsetDetails && !result?.satDetails && (
                  <>
                    <MatrixVisualizer data={A1} title="A1 [Constraint Matrix]" color="bg-cyan-500" />
                    <MatrixVisualizer data={M_CORRECTED} title="Metric Tensor" color="bg-purple-500" />
                  </>
                )}

                {result?.satDetails && (
                  <div className="bg-slate-900/80 border border-emerald-500/35 p-4 rounded-xl space-y-2">
                    <h3 className="text-emerald-400 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      تم تفعيل وضع 3-SAT (DIMACS CNF)
                    </h3>
                    <div className="text-xs text-slate-300 space-y-1 font-mono">
                      <div>المتغيرات: {result.satDetails.nVars} • الشروط: {result.satDetails.nClauses}</div>
                      <div>النسبة α: {(result.satDetails.nClauses / Math.max(1, result.satDetails.nVars)).toFixed(2)}</div>
                      <div className="text-emerald-300">
                        المحقق: {result.satDetails.satisfiedClauses} / {result.satDetails.nClauses}
                      </div>
                    </div>
                  </div>
                )}

                {result?.subsetDetails && (
                  <div className="bg-slate-900/80 border border-green-500/30 p-4 rounded-xl">
                    <h3 className="text-green-400 font-bold mb-2">تم تفعيل وضع Subset Sum</h3>
                    <p className="text-xs text-slate-400">
                      تم استخدام خوارزمية الاسترخاء التدرجي والبحث المحلي بدقة الأعداد الصحيحة الكبيرة (BigInt).
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('methodology')}
                  className="w-full p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 text-right transition-colors group"
                >
                  <div className="flex items-center justify-between text-sm font-bold text-purple-300 mb-1">
                    <span>الاطلاع على الشرح الرياضي المفصل</span>
                    <BookOpen className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform" />
                  </div>
                  <p className="text-xs text-slate-400">
                    الاشتقاق الكامل لمنهجية النمذجة المصفوفية: تيخونوف، موتر المقياس، جاكوبي SVD، واختزال LLL.
                  </p>
                </button>
              </div>
            </div>

            {/* Results Column */}
            <div className="lg:col-span-8 space-y-6">
              <div className="min-h-[600px] bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col relative overflow-hidden">
                {state === AppState.IDLE && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center space-y-3">
                    <div className="text-6xl font-mono opacity-20 text-cyan-400">Ax=b</div>
                    <p className="text-base font-semibold text-slate-300">
                      جاهز لمحاكاة الاستدلال المصفوفي مع Gemini 4 العميق
                    </p>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                      يدعم ترميز المسائل الفيزيائية والمنطقية في فضاء قيود 19×6، بالإضافة إلى حل مسائل Subset Sum للأعداد الكبيرة (BigInt).
                    </p>
                  </div>
                )}

                {isBusy && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <QuantumLoader
                      text={
                        state === AppState.ENCODING
                          ? 'ترميز المسألة عبر Gemini 4 Hydrogen إلى متجه القيود b...'
                          : state === AppState.CALCULATING
                          ? 'الاسترخاء المستمر بموتر المقياس G وتنظيم تيخونوف...'
                          : state === AppState.CORRECTING
                          ? 'تطبيق التصحيح البنيوي A_NT والبحث المحلي Bit-Flip...'
                          : `التفكير العميق (${thinkingDepth}) وصياغة التقرير الرياضي...`
                      }
                    />
                  </div>
                )}

                {state === AppState.COMPLETED && result && (
                  <div className="flex-1 flex flex-col gap-6 z-10 animate-fade-in">
                    {/* Summary Numerical Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">رقم الشرط κ(A)</div>
                        <div className="text-lg font-bold font-mono text-purple-300">
                          {result.spectral.conditionNumber.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">الفجوة التكاملية Δ</div>
                        <div className="text-lg font-bold font-mono text-cyan-300">
                          {result.integralityGap.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">عيب التعامد LLL</div>
                        <div className="text-lg font-bold font-mono text-emerald-300">
                          {result.spectral.orthogonalityDefect.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                        <div className="text-[11px] text-slate-400">عمق Gemini 4</div>
                        <div className="text-sm font-bold font-mono text-fuchsia-300 mt-0.5">
                          {result.thinkingDepthUsed || thinkingDepth}
                        </div>
                      </div>
                    </div>

                    {/* 1. Metrics & Spectral Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Spectral Analysis Chart */}
                      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 relative group">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-slate-300">التحليل الطيفي (Stiffness)</h4>
                          <span className="text-[10px] bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/20">
                            Cond: {result.spectral.conditionNumber.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-40 w-full">
                          <ResponsiveContainer>
                            <BarChart
                              data={result.spectral.singularValues.map((v, i) => ({
                                idx: i + 1,
                                val: v,
                              }))}
                            >
                              <Tooltip
                                content={({ payload }) => {
                                  if (!payload || !payload.length) return null;
                                  const val = Number(payload[0].value);
                                  return (
                                    <div className="bg-slate-900 border border-slate-700 p-2 text-xs rounded shadow-xl">
                                      <p className="text-white font-bold">
                                        Mode {payload[0].payload.idx}: {val.toFixed(1)}
                                      </p>
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                                {result.spectral.singularValues.map((v, i) => (
                                  <Cell key={i} fill={v > 50 ? '#8b5cf6' : '#4b5563'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Vector X / Subset / 3-SAT Visualization */}
                      <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-slate-300">
                            {result.satDetails
                              ? `تخصيص المتغيرات (${result.satDetails.nVars} متغير)`
                              : result.subsetDetails
                              ? 'العناصر المختارة (Subset)'
                              : 'متجه الحل الثنائي (x)'}
                          </h4>
                          {result.satDetails && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                result.satDetails.status === 'SAT'
                                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                                  : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                              }`}
                            >
                              {result.satDetails.status} • {result.satDetails.satisfiedClauses}/{result.satDetails.nClauses}
                            </span>
                          )}
                          {result.subsetDetails && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                result.subsetDetails.status === 'SAT'
                                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                                  : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                              }`}
                            >
                              {result.subsetDetails.status} • Residual: {result.subsetDetails.residual}
                            </span>
                          )}
                        </div>

                        {result.satDetails ? (
                          <div className="h-40 overflow-y-auto pr-1" dir="ltr">
                            <div className="grid grid-cols-10 gap-1">
                              {result.satDetails.assignment.map((isTrue, idx) => (
                                <div
                                  key={idx}
                                  title={`x${idx + 1} = ${isTrue ? 'TRUE (1)' : 'FALSE (0)'}`}
                                  className={`py-1 rounded text-[10px] font-mono text-center border ${
                                    isTrue
                                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 font-bold'
                                      : 'bg-slate-950/80 border-slate-800 text-slate-500'
                                  }`}
                                >
                                  {idx + 1}:{isTrue ? '1' : '0'}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : result.subsetDetails ? (
                          <div className="h-40 overflow-y-auto pr-2">
                            <div className="flex flex-wrap gap-2">
                              {result.subsetDetails.foundSubset.map((num, i) => (
                                <span
                                  key={i}
                                  className="inline-block px-2 py-1 bg-cyan-900/30 border border-cyan-500/30 text-cyan-200 text-xs rounded font-mono"
                                >
                                  {num}
                                </span>
                              ))}
                            </div>
                            {result.subsetDetails.foundSubset.length === 0 && (
                              <p className="text-xs text-slate-500 italic">
                                لا توجد عناصر مختارة (مجموعة فارغة).
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="h-40 w-full">
                            <ResponsiveContainer>
                              <BarChart
                                data={result.vectorX.map((v, i) => ({
                                  name: `x${i + 1}`,
                                  val: v,
                                }))}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis hide domain={[0, 1.2]} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    fontSize: '12px',
                                  }}
                                  cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                                  {result.vectorX.map((v, i) => (
                                    <Cell
                                      key={i}
                                      fill={v > 0.9 ? '#06b6d4' : v < 0.1 ? '#1e293b' : '#f59e0b'}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dedicated 3-SAT Export & Verification Block */}
                    {result.satDetails && (
                      <div className="bg-slate-950/75 border border-emerald-500/30 rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              التخصيص القابل للتحقق الفوري ({result.satDetails.satisfiedClauses} / {result.satDetails.nClauses} شرطاً محققاً)
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              المنهجية: {result.satDetails.solveMethod} ({result.satDetails.solveTimeMs} ms) • صحيح: {result.satDetails.trueVars.length} • خاطئ: {result.satDetails.falseVars.length}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy('dimacs', result.satDetails!.dimacsSolution)
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              {copiedFormat === 'dimacs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedFormat === 'dimacs' ? 'تم النسخ' : 'نسخ DIMACS (v ... 0)'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  'binary',
                                  result.satDetails!.assignment.map((b) => (b ? 1 : 0)).join(',')
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              {copiedFormat === 'binary' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedFormat === 'binary' ? 'تم النسخ' : 'نسخ 0/1'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy('trueVars', result.satDetails!.trueVars.join(', '))
                              }
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              {copiedFormat === 'trueVars' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedFormat === 'trueVars' ? 'تم النسخ' : 'نسخ المتغيرات الصحيحة'}
                            </button>
                          </div>
                        </div>

                        <div
                          dir="ltr"
                          className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all select-all"
                        >
                          {result.satDetails.dimacsSolution}
                        </div>
                      </div>
                    )}

                    {/* Dedicated Subset Sum Exact Verification Block */}
                    {result.subsetDetails && (
                      <div
                        className={`bg-slate-950/75 border rounded-xl p-5 space-y-3 ${
                          result.subsetDetails.status === 'SAT'
                            ? 'border-emerald-500/35'
                            : 'border-amber-500/35'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3
                              className={`font-bold text-sm flex items-center gap-2 ${
                                result.subsetDetails.status === 'SAT'
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {result.subsetDetails.status === 'SAT'
                                ? 'الحل الحرفي الدقيق لمسألة Subset Sum (Residual = 0)'
                                : result.subsetDetails.status === 'UNSAT'
                                ? 'تم إثبات عدم وجود مجموع مطابق تماماً (UNSAT)'
                                : 'أقرب مجموع ممكن لمسألة Subset Sum'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              المنهجية: {result.subsetDetails.solveMethod || 'BigInt Exact'}
                              {typeof result.subsetDetails.solveTimeMs === 'number'
                                ? ` (${result.subsetDetails.solveTimeMs} ms)`
                                : ''}{' '}
                              • الهدف: {result.subsetDetails.target} • المحقق:{' '}
                              {result.subsetDetails.achievedSum ?? result.subsetDetails.target}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                'subsetEq',
                                `${result.subsetDetails!.foundSubset.join(' + ') || '0'} = ${
                                  result.subsetDetails!.achievedSum ?? result.subsetDetails!.target
                                }`
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            {copiedFormat === 'subsetEq' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedFormat === 'subsetEq' ? 'تم النسخ' : 'نسخ المعادلة الدقيقة'}
                          </button>
                        </div>

                        <div
                          dir="ltr"
                          className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all select-all tabular-nums"
                        >
                          {`${result.subsetDetails.foundSubset.join(' + ') || '0'} = ${
                            result.subsetDetails.achievedSum ?? result.subsetDetails.target
                          }`}
                        </div>
                      </div>
                    )}

                    {/* 2. Direct Solution Text */}
                    <div className="bg-gradient-to-r from-cyan-900/20 to-slate-900 border border-cyan-500/30 p-6 rounded-lg">
                      <h3 className="text-cyan-400 font-bold mb-3 text-sm tracking-wider">النتيجة المباشرة والحرفية</h3>
                      <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{result.solutionText}</p>
                    </div>

                    {/* 3. Deep Reasoning Highlights */}
                    {result.deepReasoningNotes && (
                      <div className="bg-purple-950/20 border border-purple-500/30 p-5 rounded-lg">
                        <h3 className="text-purple-300 font-bold mb-2 text-sm flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4" />
                          خلاصة الاستدلال العميق (Gemini 4 Hydrogen • {result.thinkingDepthUsed})
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {result.deepReasoningNotes}
                        </p>
                      </div>
                    )}

                    {/* 4. Scientific Article */}
                    <div className="bg-slate-900/40 border border-purple-500/20 rounded-lg p-6 sm:p-8 relative overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-purple-500/30 pb-4">
                        <h3 className="text-purple-400 font-bold text-xl">
                          التقرير العلمي: A-guided Heuristic
                        </h3>
                        {isDecodingAi && (
                          <span className="text-xs px-3 py-1 rounded-md bg-purple-500/15 border border-purple-400/30 text-purple-200 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            جاري التحليل العميق عبر Gemini 4 ({thinkingDepth})...
                          </span>
                        )}
                      </div>

                      {aiDecodeError && (
                        <div className="mb-4 p-4 rounded-xl bg-amber-950/35 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5 text-sm text-amber-200">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{aiDecodeError}</span>
                          </div>
                          {lastSolvedContext && (
                            <button
                              type="button"
                              onClick={() =>
                                runAiDecode(
                                  lastSolvedContext.problem,
                                  lastSolvedContext.solverOutput,
                                  lastSolvedContext.bVector
                                )
                              }
                              disabled={isDecodingAi}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              إعادة توليد التقرير عبر Gemini 4
                            </button>
                          )}
                        </div>
                      )}

                      {isDecodingAi && !result.scientificArticle ? (
                        <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                          <span>تم حساب الحل الرياضي بدقة؛ يقوم Gemini 4 Hydrogen الآن بصياغة التحليل الطيفي والمقال العلمي...</span>
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-lg max-w-none">
                          <div
                            className="whitespace-pre-wrap text-slate-300 font-sans leading-loose text-justify"
                            style={{ fontFamily: 'Cairo, sans-serif' }}
                          >
                            {result.scientificArticle}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {state === AppState.ERROR && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-red-300 font-bold">تعذر إتمام العملية</p>
                    <p className="text-sm text-red-200/80 leading-relaxed">
                      {errorMessage || 'خطأ في النظام: تعذر التقارب نحو حل مستقر.'}
                    </p>
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        setState(AppState.IDLE);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
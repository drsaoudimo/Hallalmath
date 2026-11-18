import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Binary,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Dices,
  GitMerge,
  Info,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SemiprimeFactorizationResult } from '../types';
import {
  analyzeSemiprimeAndSimulateShor,
  generateRandomSemiprime,
} from '../utils/semiprimeMath';
import { runShorSimulation } from '../services/solverService';

interface PresetItem {
  label: string;
  n: string;
  bitsLabel: string;
}

const SEMIPRIME_PRESETS: PresetItem[] = [
  { label: '15 (3×5)', n: '15', bitsLabel: '4 بت' },
  { label: '21 (3×7)', n: '21', bitsLabel: '5 بت' },
  { label: '77 (7×11)', n: '77', bitsLabel: '7 بت' },
  { label: '3233 (RSA تعليمي)', n: '3233', bitsLabel: '12 بت' },
  { label: '10403', n: '10403', bitsLabel: '14 بت' },
  { label: '30 بت BigInt', n: '1073217479', bitsLabel: '30 بت' },
  { label: '64 بت BigInt', n: '18446744073709551557', bitsLabel: '64 بت' },
  { label: '256 بت RSA شبه أولي', n: '115792089237316195423570985008687907853269984665640564039457584007913129639937', bitsLabel: '256 بت' },
];

const RANDOM_BIT_TARGETS = [32, 64, 128, 256, 512, 1024];

export const SemiprimeFactorizerPanel: React.FC = () => {
  const [inputN, setInputN] = useState<string>('21');
  const [baseMode, setBaseMode] = useState<'auto' | 'manual'>('auto');
  const [manualBaseA, setManualBaseA] = useState<string>('2');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [result, setResult] = useState<SemiprimeFactorizationResult>(() =>
    analyzeSemiprimeAndSimulateShor('21')
  );

  const liveInputStats = useMemo(() => {
    const cleaned = inputN.replace(/[\s,_]/g, '').trim();
    if (!cleaned || !/^\d+$/.test(cleaned)) {
      return { valid: false, bits: 0, digits: 0 };
    }
    try {
      const val = BigInt(cleaned);
      return {
        valid: val >= 4n,
        bits: val > 0n ? val.toString(2).length : 0,
        digits: cleaned.length,
      };
    } catch {
      return { valid: false, bits: 0, digits: 0 };
    }
  }, [inputN]);

  const runAnalysis = async (
    targetN = inputN,
    mode = baseMode,
    customA = manualBaseA
  ) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      await runShorSimulation(
        targetN,
        mode === 'manual' ? customA : undefined
      );
      const res = analyzeSemiprimeAndSimulateShor(
        targetN,
        mode === 'manual' ? customA : undefined
      );
      setResult(res);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تحليل العدد المدخل.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectPreset = (n: string) => {
    setInputN(n);
    setBaseMode('auto');
    runAnalysis(n, 'auto', manualBaseA);
  };

  const handleGenerateRandom = (bits: number) => {
    const generated = generateRandomSemiprime(bits);
    setInputN(generated.n);
    setBaseMode('auto');
    runAnalysis(generated.n, 'auto', manualBaseA);
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Clipboard blocked in iframe fallback
    }
  };

  const classificationLabel = (() => {
    switch (result.classification) {
      case 'SEMIPRIME':
        return {
          text: 'عدد شبه أولي فردي دقيق (p × q)',
          tone: 'text-emerald-300 border-emerald-500/35 bg-emerald-950/30',
        };
      case 'PRIME_SQUARE':
        return {
          text: 'مربع عدد أولي (p²)',
          tone: 'text-cyan-300 border-cyan-500/35 bg-cyan-950/30',
        };
      case 'EVEN_SEMIPRIME':
        return {
          text: 'شبه أولي زوجي (2 × q)',
          tone: 'text-cyan-300 border-cyan-500/35 bg-cyan-950/30',
        };
      case 'PRIME':
        return {
          text: 'عدد أولي (غير قابل للتحليل)',
          tone: 'text-amber-300 border-amber-500/35 bg-amber-950/30',
        };
      case 'COMPOSITE_MULTI':
        return {
          text: 'عدد مركب متعدد العوامل (> 2 عامل أولي)',
          tone: 'text-amber-300 border-amber-500/35 bg-amber-950/30',
        };
    }
  })();

  const currentComplexityRow = useMemo(() => {
    return (
      result.complexitySeries.find((pt) => pt.bits === result.bitLength) ??
      result.complexitySeries[0]
    );
  }, [result]);

  const benchmarkRows = useMemo(() => {
    const pick = [result.bitLength, 256, 2048];
    const uniqueBits = Array.from(new Set(pick)).sort((a, b) => a - b);
    return uniqueBits.map((b) => {
      const existing = result.complexitySeries.find((pt) => pt.bits === b);
      if (existing) return existing;
      return currentComplexityRow;
    });
  }, [result, currentComplexityRow]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* Zone 1: Control & Input Deck */}
      <div className="lg:col-span-4 space-y-5">
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Binary className="w-5 h-5 text-cyan-400" />
              مختبر الأعداد شبه الأولية
            </h2>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              BigInt · Miller-Rabin
            </span>
          </div>

          {/* N Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="semiprime-input" className="font-bold text-slate-300">
                العدد المراد تحليله (N)
              </label>
              <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
                {liveInputStats.valid
                  ? `${liveInputStats.bits} بت · ${liveInputStats.digits} أرقام`
                  : 'أدخل عدداً ≥ 4'}
              </span>
            </div>
            <input
              id="semiprime-input"
              type="text"
              dir="ltr"
              value={inputN}
              onChange={(e) => setInputN(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runAnalysis();
              }}
              placeholder="مثال: 3233 أو 281474943156223"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-3 font-mono text-base text-cyan-100 outline-none transition-colors tabular-nums"
            />
          </div>

          {/* Graded Presets */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400">أمثلة متدرجة جاهزة</div>
            <div className="flex flex-wrap gap-1.5">
              {SEMIPRIME_PRESETS.map((preset) => (
                <button
                  key={preset.n}
                  type="button"
                  onClick={() => handleSelectPreset(preset.n)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    inputN.trim() === preset.n
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                    {preset.bitsLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Random Semiprime Generator */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Dices className="w-4 h-4 text-emerald-400" />
                توليد عدد شبه أولي عشوائي (p × q)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {RANDOM_BIT_TARGETS.map((bits) => (
                <button
                  key={bits}
                  type="button"
                  onClick={() => handleGenerateRandom(bits)}
                  className="px-2 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-[11px] font-mono text-slate-200 transition-colors whitespace-nowrap tabular-nums"
                >
                  {bits} بت
                </button>
              ))}
            </div>
          </div>

          {/* Base a Control */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-slate-300">
              الأساس الاختباري (a) لمحاكاة شور
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setBaseMode('auto')}
                className={`px-2.5 py-2 rounded-md text-xs font-bold border transition-colors whitespace-nowrap ${
                  baseMode === 'auto'
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                اختيار تلقائي ذكي
              </button>
              <button
                type="button"
                onClick={() => setBaseMode('manual')}
                className={`px-2.5 py-2 rounded-md text-xs font-bold border transition-colors whitespace-nowrap ${
                  baseMode === 'manual'
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                تحديد a يدوياً
              </button>
            </div>
            {baseMode === 'manual' && (
              <div className="pt-1">
                <input
                  type="text"
                  dir="ltr"
                  value={manualBaseA}
                  onChange={(e) => setManualBaseA(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runAnalysis();
                  }}
                  placeholder="أدخل قيمة a (2 ≤ a < N)"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-md px-3 py-2 font-mono text-sm text-cyan-100 outline-none tabular-nums"
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => runAnalysis()}
            disabled={!liveInputStats.valid || isAnalyzing}
            className="w-full py-3 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التحليل في خيط خلفي (Web Worker)...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                تحليل العوامل ومحاكاة دورية شور
              </>
            )}
          </button>
        </div>

        {/* Scientific Honesty Note */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>الشفافية الرياضية حول الزمن متعدد الحدود</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            على المعالجات التقليدية لا تُعرف خوارزمية كلاسيكية حتمية لتحليل الأعداد شبه الأولية الكبيرة بزمن متعدد الحدود؛ لذا يستخرج هذا المختبر العوامل بدقة{' '}
            <span className="font-mono text-slate-200">BigInt</span> عبر{' '}
            <span className="font-mono text-slate-200">Pollard&apos;s Rho</span> بتعقيد{' '}
            <span className="font-mono text-slate-200">O(N^1/4)</span>، بينما يحاكي خطوة إيجاد الفترة الدورية{' '}
            <span className="font-mono text-slate-200">r</span> في خوارزمية شور لتوضيح سبب تفوق{' '}
            <span className="font-mono text-slate-200">QFT</span> الكمومي بتعقيد{' '}
            <span className="font-mono text-slate-200">O((log N)³)</span>.
          </p>
        </div>
      </div>

      {/* Zone 2: Main Proof, Shor Simulation & Complexity Stage */}
      <div className="lg:col-span-8 space-y-6">
        {/* 1. Prime Factors p, q & Multiplication Verification */}
        <section className="bg-slate-900/75 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                العوامل الأولية والتحقق من الضرب (p × q = N)
              </h3>
              <p className="text-xs text-slate-400">
                الطريقة الكلاسيكية المنفذة: {result.classicalMethod}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-md border text-xs font-bold flex items-center gap-1.5 ${classificationLabel.tone}`}
            >
              {result.isExactSemiprime ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span>{classificationLabel.text}</span>
            </div>
          </div>

          {/* Compact Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">العدد المدخل N</div>
              <div
                dir="ltr"
                className="text-sm font-bold font-mono text-slate-100 truncate tabular-nums mt-0.5"
                title={result.inputN}
              >
                {result.inputN}
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">حجم المفتاح</div>
              <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
                {result.bitLength} بت · {result.decimalDigits} خانات
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">زمن الحساب الكلاسيكي</div>
              <div className="text-sm font-bold font-mono text-emerald-300 tabular-nums mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {result.elapsedMs} ms
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">تحقق الضرب</div>
              <div className="text-sm font-bold text-emerald-300 mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {result.productVerified ? 'p × q = N صحيح' : 'غير مطابق'}
              </div>
            </div>
          </div>

          {/* p and q Readout */}
          {result.classification === 'PRIME' ? (
            <div className="bg-amber-950/25 border border-amber-500/35 rounded-lg p-4 text-sm text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">العدد {result.inputN} أولي بالفعل</div>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  أثبت اختبار Miller-Rabin أن هذا العدد أولي ولا ينقسم إلى عاملين غير تافهين. أدخل حاصل ضرب عددين أوليين أو استخدم المولد التلقائي.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">العامل الأول (p)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-300">
                        {result.pIsPrime ? 'أولي مؤكد' : 'مركب'}
                      </span>
                      {result.p && (
                        <button
                          type="button"
                          onClick={() => handleCopy('p', result.p!)}
                          className="text-slate-400 hover:text-cyan-300 transition-colors"
                          title="نسخ العامل p"
                        >
                          {copiedKey === 'p' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    dir="ltr"
                    className="text-lg sm:text-xl font-bold font-mono text-emerald-300 break-all tabular-nums"
                  >
                    {result.p}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">
                      {result.isExactSemiprime ? 'العامل الثاني (q)' : 'العامل المتبقي (N / p)'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono ${
                          result.qIsPrime ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {result.qIsPrime ? 'أولي مؤكد' : 'مركب (له عوامل إضافية)'}
                      </span>
                      {result.q && (
                        <button
                          type="button"
                          onClick={() => handleCopy('q', result.q!)}
                          className="text-slate-400 hover:text-cyan-300 transition-colors"
                          title="نسخ العامل q"
                        >
                          {copiedKey === 'q' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    dir="ltr"
                    className="text-lg sm:text-xl font-bold font-mono text-cyan-300 break-all tabular-nums"
                  >
                    {result.q}
                  </div>
                </div>
              </div>

              {/* Exact Multiplication Proof Equation */}
              <div
                dir="ltr"
                className="bg-slate-950/90 border border-emerald-500/30 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs sm:text-sm tabular-nums"
              >
                <div className="text-slate-200 break-all">
                  <span className="text-emerald-300 font-bold">{result.p}</span>
                  <span className="text-slate-500 mx-2">×</span>
                  <span className="text-cyan-300 font-bold">{result.q}</span>
                  <span className="text-slate-500 mx-2">=</span>
                  <span className="text-white font-bold">{result.productCheck}</span>
                </div>
                <span className="text-emerald-400 text-xs font-sans font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  تم التحقق الجبري التام
                </span>
              </div>

              {/* Show full prime decomposition if > 2 factors */}
              {result.classification === 'COMPOSITE_MULTI' && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-3 text-xs flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-bold">التحليل الأولي الكامل:</span>
                  <span dir="ltr" className="font-mono text-amber-300 tabular-nums">
                    {result.allPrimeFactors
                      .map((item) =>
                        item.exponent > 1 ? `${item.factor}^${item.exponent}` : item.factor
                      )
                      .join(' × ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. Shor Period-Finding Trace & Visualizations */}
        <section className="bg-slate-900/75 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Waves className="w-5 h-5 text-cyan-400" />
                خطوات إيجاد الفترة الدورية (r) ومقارنتها بخوارزمية شور
              </h3>
              <p className="text-xs text-slate-400">
                تتبع الدالة الأسية المعيارية f(x) = a^x mod N وكيفية استخراج العوامل عبر QFT
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300 tabular-nums">
              a = {result.shorSimulation.selectedBaseA} · r ={' '}
              {result.shorSimulation.orderR ?? '—'}
            </div>
          </div>

          {/* Manual Base Suggestion Banner when needed */}
          {result.shorSimulation.suggestedWorkingBase && (
            <div className="p-4 rounded-lg bg-amber-950/35 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  الأساس المختار يدوياً (<span className="font-mono">a = {result.shorSimulation.selectedBaseA}</span>) لم يحقق شرطي شور. يمكنك تجربة الأساس البديل المقترح.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextA = result.shorSimulation.suggestedWorkingBase!;
                  setBaseMode('manual');
                  setManualBaseA(nextA);
                  runAnalysis(inputN, 'manual', nextA);
                }}
                className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                تجربة الأساس الناجح (a = {result.shorSimulation.suggestedWorkingBase})
              </button>
            </div>
          )}

          {/* Key Shor State Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">الأساس الاختباري a</div>
              <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
                {result.shorSimulation.selectedBaseA}
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">الفترة الدورية r</div>
              <div
                dir="ltr"
                className="text-sm font-bold font-mono text-purple-300 truncate tabular-nums mt-0.5"
                title={result.shorSimulation.orderR ?? '—'}
              >
                {result.shorSimulation.orderR ?? 'مباشر'}
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">هل r زوجية؟</div>
              <div className="text-sm font-bold mt-0.5 text-slate-200">
                {result.shorSimulation.orderR === null
                  ? 'غير مطلوب'
                  : result.shorSimulation.isREven
                  ? 'نعم (زوجية)'
                  : 'لا (فردية)'}
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">a^(r/2) mod N</div>
              <div
                dir="ltr"
                className="text-sm font-bold font-mono text-slate-200 truncate tabular-nums mt-0.5"
                title={result.shorSimulation.halfPowerModN ?? '—'}
              >
                {result.shorSimulation.halfPowerModN ?? '—'}
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400">حالة الاستخراج</div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  result.shorSimulation.nonTrivialRoot
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }`}
              >
                {result.shorSimulation.nonTrivialRoot ? 'نجح الاستخلاص' : 'يحتاج إعادة'}
              </div>
            </div>
          </div>

          {/* Ordered Step-by-Step Shor Trace */}
          <div className="space-y-2.5">
            {result.shorSimulation.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center tabular-nums">
                      {step.stepNumber}
                    </span>
                    <span className="text-sm font-bold text-slate-100">{step.title}</span>
                  </div>
                  <span
                    dir="ltr"
                    className={`text-xs font-mono font-bold tabular-nums ${
                      step.status === 'passed'
                        ? 'text-emerald-300'
                        : step.status === 'warning'
                        ? 'text-amber-300'
                        : 'text-cyan-300'
                    }`}
                  >
                    {step.resultValue}
                  </span>
                </div>
                <div
                  dir="ltr"
                  className="bg-slate-900/90 border border-slate-800/90 rounded px-3 py-2 font-mono text-xs text-cyan-200 overflow-x-auto tabular-nums"
                >
                  {step.formula}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{step.explanation}</p>
              </div>
            ))}
          </div>

          {/* Candidate Attempts Log */}
          {result.shorSimulation.attempts.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="text-xs font-bold text-slate-300">
                سجل محاولات اختيار الأساس (a) حتى نجاح شروط شور:
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-2">a</th>
                      <th className="py-2 px-2">الفترة r</th>
                      <th className="py-2 px-2">النتيجة</th>
                      <th className="py-2 px-2">الملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {result.shorSimulation.attempts.map((att, idx) => (
                      <tr key={idx} className="text-slate-300">
                        <td className="py-2 px-2 font-mono tabular-nums text-cyan-300">
                          {att.baseA}
                        </td>
                        <td className="py-2 px-2 font-mono tabular-nums">
                          {att.orderR ?? '—'}
                        </td>
                        <td className="py-2 px-2 font-bold">
                          {att.outcome === 'SUCCESS' ? (
                            <span className="text-emerald-300">ناجح</span>
                          ) : att.outcome === 'ODD_R' ? (
                            <span className="text-amber-300">r فردي</span>
                          ) : (
                            <span className="text-amber-300">جذر تافه</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-slate-400">{att.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dual Visualizations: Modular Periodicity Wave + QFT Spectrum */}
          {result.shorSimulation.periodicSeries.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Periodic Modular Function Chart */}
              <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                    تمثيل الدورية f(x) = {result.shorSimulation.selectedBaseA}^x mod {result.inputN}
                  </h4>
                  <span className="text-[11px] font-mono text-cyan-300 tabular-nums">
                    {result.shorSimulation.periodicTruncated
                      ? 'أول 48 خطوة'
                      : `فترة r = ${result.shorSimulation.orderR}`}
                  </span>
                </div>
                <div className="h-48 w-full" dir="ltr">
                  <ResponsiveContainer>
                    <BarChart data={result.shorSimulation.periodicSeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={42} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          fontSize: '12px',
                        }}
                        formatter={(val: number) => [val.toLocaleString('en-US'), 'f(x)']}
                        labelFormatter={(label) => `x = ${label}`}
                      />
                      <Bar dataKey="fx" radius={[2, 2, 0, 0]}>
                        {result.shorSimulation.periodicSeries.map((pt, idx) => (
                          <Cell
                            key={idx}
                            fill={pt.isPeriodMarker ? '#10b981' : '#06b6d4'}
                            fillOpacity={pt.isPeriodMarker ? 1 : 0.65}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-slate-400">
                  الأعمدة الخضراء تمثل نقاط عودة الدالة إلى القيمة <span className="font-mono text-emerald-300">1</span> عند مضاعفات الفترة الدورية <span className="font-mono text-emerald-300">r</span>.
                </p>
              </div>

              {/* Simulated QFT Probability Peaks */}
              <div className="bg-slate-950/75 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                    محاكاة قمم التداخل الكمومي (QFT)
                  </h4>
                  <span className="text-[11px] font-mono text-purple-300 tabular-nums">
                    التباعد الطوري ∝ 1/r
                  </span>
                </div>
                <div className="h-48 w-full" dir="ltr">
                  <ResponsiveContainer>
                    <BarChart data={result.shorSimulation.qftSpectrum}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="bin" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={34} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          fontSize: '12px',
                        }}
                        formatter={(val: number) => [`${(val * 100).toFixed(1)}%`, 'احتمال القياس']}
                        labelFormatter={(label) => `حالة قياس k = ${label}`}
                      />
                      <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
                        {result.shorSimulation.qftSpectrum.map((pt, idx) => (
                          <Cell
                            key={idx}
                            fill={pt.isPeak ? '#a855f7' : '#334155'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-slate-400">
                  يلغي التداخل الكمومي الحالات غير المتوافقة ويُركّز احتمال القياس في قمم متباعدة بمسافة <span className="font-mono text-purple-300">Q / r</span>، تُقرأ بعدها عبر الكسور المستمرة.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 3. Classical vs Quantum Complexity Comparison */}
        <section className="bg-slate-900/75 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                مقارنة التعقيد الزمني والحسابي (التقليدي مقابل الكمي)
              </h3>
              <p className="text-xs text-slate-400">
                مقياس لوغاريتمي (log₁₀ لعدد العمليات التقريبي) من 8 بت حتى RSA-2048
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-300 tabular-nums flex items-center gap-1.5">
              <GitMerge className="w-4 h-4" />
              المدخل الحالي: {result.bitLength} بت
            </div>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer>
              <LineChart data={result.complexitySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={48}
                  label={{
                    value: 'log10(Ops)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '12px',
                  }}
                  formatter={(val: number, name: string) => [
                    `10^${val.toFixed(1)} عملية`,
                    name,
                  ]}
                  labelFormatter={(label) => `طول العدد: ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <ReferenceLine
                  x={`${result.bitLength}b`}
                  stroke="#22d3ee"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="trialLog10"
                  name="القسمة التجريبية O(N^1/2)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rhoLog10"
                  name="Pollard's Rho O(N^1/4)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="gnfsLog10"
                  name="GNFS (أفضل تقليدي)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="shorLog10"
                  name="Shor كمي O((log N)³)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quantitative Benchmark Table */}
          <div className="overflow-x-auto bg-slate-950/75 border border-slate-800 rounded-lg">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">حجم العدد (بت)</th>
                  <th className="py-2.5 px-3">Pollard&apos;s Rho (كلاسيكي)</th>
                  <th className="py-2.5 px-3">GNFS (دون أسي)</th>
                  <th className="py-2.5 px-3 text-emerald-300">خوارزمية شور (كمي)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {benchmarkRows.map((row) => {
                  const isCurrent = row.bits === result.bitLength;
                  return (
                    <tr
                      key={row.bits}
                      className={isCurrent ? 'bg-cyan-950/25 text-slate-100' : 'text-slate-300'}
                    >
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold">
                        {row.bits} بت {isCurrent ? '(مدخلك)' : row.bits === 2048 ? '(RSA-2048)' : ''}
                      </td>
                      <td dir="ltr" className="py-2.5 px-3 font-mono tabular-nums text-amber-300">
                        {row.rhoOpsText}
                      </td>
                      <td dir="ltr" className="py-2.5 px-3 font-mono tabular-nums text-purple-300">
                        {row.gnfsOpsText}
                      </td>
                      <td dir="ltr" className="py-2.5 px-3 font-mono tabular-nums text-emerald-300 font-bold">
                        {row.shorOpsText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

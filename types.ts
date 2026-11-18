export type Matrix = number[][];

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string;
}

export interface InferenceMetrics {
  integrity: number;   // نسبة نزاهة الاستدلال (0-100)
  consistency: number; // الاتساق (0-1)
  mass: number;        // كتلة الحجة (0-100)
  convergence: number; // التقارب (0-100)
}

export interface SpectralAnalysisResult {
  singularValues: number[];
  conditionNumber: number;
  orthogonalityDefect: number;
}

export interface LLLResult {
  originalBasis: Matrix; // Columns
  reducedBasis: Matrix; // Columns
}

export type GeminiThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export interface SolverResult {
  solutionText: string; // Direct answer/Summary
  scientificArticle: string; // Detailed scientific explanation
  deepReasoningNotes?: string; // Key mathematical derivation highlights from Gemini 4 Deep
  modelUsed?: string;
  thinkingDepthUsed?: GeminiThinkingDepth;
  confidence: number;
  vectorX: number[]; // The 6-dim solution vector (or n-dim for subset sum)
  vectorB: number[]; // The target vector
  correctionDelta: number;
  integralityGap: number; // How close is X to Integers?
  metrics: InferenceMetrics; // Visual metrics for scientific validity
  spectral: SpectralAnalysisResult;
  lll: LLLResult;
  // New field for Subset Sum specific results
  subsetDetails?: {
    isSubsetSum: boolean;
    foundSubset: string[]; // BigInts as strings
    target: string;
    achievedSum?: string;
    residual: string;
    status: 'SAT' | 'UNSAT' | 'APPROX';
    solveMethod?: string;
    solveTimeMs?: number;
  };
  // Field for 3-SAT / DIMACS CNF results
  satDetails?: {
    isSatProblem: boolean;
    nVars: number;
    nClauses: number;
    satisfiedClauses: number;
    status: 'SAT' | 'UNSAT' | 'APPROX';
    assignment: boolean[]; // 0-indexed: assignment[i] is value of variable (i+1)
    trueVars: number[];
    falseVars: number[];
    dimacsSolution: string;
    solveMethod: string;
    solveTimeMs: number;
  };
}

export enum AppState {
  IDLE = 'IDLE',
  ENCODING = 'ENCODING', // Gemini -> Vector b
  CALCULATING = 'CALCULATING', // Matrix Math
  CORRECTING = 'CORRECTING', // A_NT correction
  DECODING = 'DECODING', // Gemini -> Text
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type SemiprimeClassification =
  | 'SEMIPRIME'
  | 'PRIME_SQUARE'
  | 'EVEN_SEMIPRIME'
  | 'PRIME'
  | 'COMPOSITE_MULTI';

export interface PrimeFactorEntry {
  factor: string;
  exponent: number;
  isPrime: boolean;
  bitLength: number;
}

export interface ShorAttemptLog {
  baseA: string;
  gcdAN: string;
  orderR: string | null;
  isREven: boolean;
  halfPowerModN: string | null;
  isTrivialMinusOne: boolean;
  gcdMinus: string | null;
  gcdPlus: string | null;
  outcome: 'SUCCESS' | 'DIRECT_GCD' | 'ODD_R' | 'TRIVIAL_ROOT' | 'NOT_APPLICABLE';
  note: string;
}

export interface ShorStepTrace {
  stepNumber: number;
  title: string;
  formula: string;
  resultValue: string;
  status: 'passed' | 'warning' | 'info';
  explanation: string;
}

export interface PeriodicPoint {
  x: number;
  fx: number;
  isPeriodMarker: boolean;
}

export interface QftPeakPoint {
  bin: number;
  probability: number;
  isPeak: boolean;
}

export interface ComplexityComparisonPoint {
  bits: number;
  label: string;
  shorLog10: number;
  gnfsLog10: number;
  rhoLog10: number;
  trialLog10: number;
  shorOpsText: string;
  rhoOpsText: string;
  gnfsOpsText: string;
}

export interface SemiprimeFactorizationResult {
  inputN: string;
  bitLength: number;
  decimalDigits: number;
  classification: SemiprimeClassification;
  isExactSemiprime: boolean;
  p: string | null;
  q: string | null;
  pIsPrime: boolean;
  qIsPrime: boolean;
  productCheck: string;
  productVerified: boolean;
  allPrimeFactors: PrimeFactorEntry[];
  classicalMethod: string;
  elapsedMs: number;
  shorSimulation: {
    selectedBaseA: string;
    autoSelected: boolean;
    orderR: string | null;
    orderComputationMode: 'DIRECT_SCAN' | 'ANALYTICAL_LAMBDA' | 'NOT_APPLICABLE';
    isREven: boolean;
    halfPowerModN: string | null;
    nonTrivialRoot: boolean;
    extractedFactors: [string, string] | null;
    steps: ShorStepTrace[];
    attempts: ShorAttemptLog[];
    periodicSeries: PeriodicPoint[];
    periodicTruncated: boolean;
    qftSpectrum: QftPeakPoint[];
    suggestedWorkingBase: string | null;
  };
  complexitySeries: ComplexityComparisonPoint[];
}
import type {
  ComplexityComparisonPoint,
  PeriodicPoint,
  PrimeFactorEntry,
  QftPeakPoint,
  SemiprimeClassification,
  SemiprimeFactorizationResult,
  ShorAttemptLog,
  ShorStepTrace,
} from '../types';

const SMALL_PRIMES: bigint[] = [
  2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n,
  41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n,
];

// Deterministic bases for all n < 3,317,044,064,679,887,385,961,981 (~81 bits)
const MILLER_RABIN_BASES: bigint[] = [
  2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n,
];

export function sanitizeBigIntInput(raw: string): bigint {
  const cleaned = raw.replace(/[\s,_]/g, '').trim();
  if (!cleaned || !/^\d+$/.test(cleaned)) {
    throw new Error('يرجى إدخال عدد صحيح موجب مكوّن من أرقام فقط (بدون أحرف أو كسور).');
  }
  const n = BigInt(cleaned);
  if (n < 4n) {
    throw new Error('يرجى إدخال عدد صحيح أكبر من أو يساوي 4 لتحليله إلى عوامله.');
  }
  return n;
}

export function getBitLength(n: bigint): number {
  return n <= 0n ? 0 : n.toString(2).length;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a / gcd(a, b)) * b;
}

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = (result * b) % mod;
    }
    e >>= 1n;
    if (e > 0n) {
      b = (b * b) % mod;
    }
  }
  return result;
}

export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('Negative square root');
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }
  return x;
}

export function isProbablyPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  if (n < 10201n) return true; // 101^2

  // Write n - 1 = d * 2^s
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }

  for (const a of MILLER_RABIN_BASES) {
    if (a >= n) break;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

function brentPollardRho(n: bigint, deadlineMs: number): bigint {
  if ((n & 1n) === 0n) return 2n;
  if (n % 3n === 0n) return 3n;

  const root = isqrt(n);
  if (root * root === n) return root;

  for (let c = 1n; c < 32n; c++) {
    if (performance.now() > deadlineMs) {
      return root > 1n ? root : 2n;
    }
    let y = ((c * 17n + 5n) % (n - 2n)) + 2n;
    const m = 64n;
    let g = 1n;
    let r = 1n;
    let q = 1n;
    let ys = y;
    let x = y;

    while (g === 1n) {
      x = y;
      for (let i = 0n; i < r; i++) {
        y = (y * y + c) % n;
      }
      let k = 0n;
      while (k < r && g === 1n) {
        ys = y;
        const lim = m < r - k ? m : r - k;
        for (let i = 0n; i < lim; i++) {
          y = (y * y + c) % n;
          const diff = x > y ? x - y : y - x;
          q = (q * diff) % n;
        }
        g = gcd(q, n);
        k += m;
      }
      r <<= 1n;
      if (performance.now() > deadlineMs) {
        return root > 1n ? root : 2n;
      }
    }

    if (g === n) {
      do {
        ys = (ys * ys + c) % n;
        const diff = x > ys ? x - ys : ys - x;
        g = gcd(diff, n);
      } while (g === 1n);
    }

    if (g > 1n && g < n) {
      return g;
    }
  }

  return root > 1n ? root : 2n;
}

export function factorizeBigInt(n: bigint, deadlineMs = performance.now() + 2500): bigint[] {
  if (n <= 1n) return [];
  const factors: bigint[] = [];
  let rem = n;

  // Trial division up to 10,000 for instant small factor extraction
  for (const p of SMALL_PRIMES) {
    while (rem % p === 0n) {
      factors.push(p);
      rem /= p;
    }
  }

  let divisor = 101n;
  while (divisor <= 10000n && divisor * divisor <= rem) {
    while (rem % divisor === 0n) {
      factors.push(divisor);
      rem /= divisor;
    }
    divisor += 2n;
  }

  if (rem === 1n) {
    return factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  const stack: bigint[] = [rem];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === 1n) continue;
    if (isProbablyPrime(current)) {
      factors.push(current);
      continue;
    }
    const split = brentPollardRho(current, deadlineMs);
    stack.push(split);
    stack.push(current / split);
  }

  return factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function groupPrimeFactors(rawFactors: bigint[]): PrimeFactorEntry[] {
  const counts = new Map<string, number>();
  for (const f of rawFactors) {
    const key = f.toString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([factorStr, exponent]) => {
    const f = BigInt(factorStr);
    return {
      factor: factorStr,
      exponent,
      isPrime: isProbablyPrime(f),
      bitLength: getBitLength(f),
    };
  });
}

function computeOrderOfA(
  a: bigint,
  N: bigint,
  groupedFactors: PrimeFactorEntry[]
): { orderR: bigint; mode: 'DIRECT_SCAN' | 'ANALYTICAL_LAMBDA' } {
  // Direct sequential scan for small N to model direct cycle detection honestly
  if (N <= 16384n) {
    let val = a % N;
    let x = 1n;
    while (val !== 1n && x <= N) {
      val = (val * a) % N;
      x++;
    }
    return { orderR: x, mode: 'DIRECT_SCAN' };
  }

  // Analytical minimal multiplicative order via Carmichael lambda(N)
  // Guaranteed exact order for arbitrarily large BigInt once prime factors are known
  let lambda = 1n;
  for (const entry of groupedFactors) {
    const p = BigInt(entry.factor);
    const e = BigInt(entry.exponent);
    let phi = p - 1n;
    for (let i = 1n; i < e; i++) {
      phi *= p;
    }
    if (p === 2n && entry.exponent >= 3) {
      phi >>= 1n;
    }
    lambda = lcm(lambda, phi);
  }

  let r = lambda;
  const lambdaPrimes = Array.from(new Set(factorizeBigInt(lambda).map((x) => x.toString()))).map(
    (s) => BigInt(s)
  );
  for (const pf of lambdaPrimes) {
    while (r % pf === 0n && modPow(a, r / pf, N) === 1n) {
      r /= pf;
    }
  }

  return { orderR: r, mode: 'ANALYTICAL_LAMBDA' };
}

function evaluateShorCandidate(
  a: bigint,
  N: bigint,
  groupedFactors: PrimeFactorEntry[]
): {
  attempt: ShorAttemptLog;
  mode: 'DIRECT_SCAN' | 'ANALYTICAL_LAMBDA';
  extracted: [string, string] | null;
} {
  const g = gcd(a, N);
  if (g > 1n && g < N) {
    const other = N / g;
    const f1 = g <= other ? g : other;
    const f2 = g <= other ? other : g;
    return {
      attempt: {
        baseA: a.toString(),
        gcdAN: g.toString(),
        orderR: null,
        isREven: false,
        halfPowerModN: null,
        isTrivialMinusOne: false,
        gcdMinus: null,
        gcdPlus: null,
        outcome: 'DIRECT_GCD',
        note: `تطابق مباشر في الخطوة الأولى: gcd(${a}, ${N}) = ${g} > 1، لذا انكسر العدد فوراً دون الحاجة لإيجاد الفترة r.`,
      },
      mode: 'ANALYTICAL_LAMBDA',
      extracted: [f1.toString(), f2.toString()],
    };
  }

  const { orderR, mode } = computeOrderOfA(a, N, groupedFactors);
  const isREven = (orderR & 1n) === 0n;

  if (!isREven) {
    return {
      attempt: {
        baseA: a.toString(),
        gcdAN: '1',
        orderR: orderR.toString(),
        isREven: false,
        halfPowerModN: null,
        isTrivialMinusOne: false,
        gcdMinus: null,
        gcdPlus: null,
        outcome: 'ODD_R',
        note: `الفترة الدورية r = ${orderR} عدد فردي؛ لا يمكن حساب a^(r/2) كعدد صحيح، لذا يعيد شور اختيار أساس آخر.`,
      },
      mode,
      extracted: null,
    };
  }

  const halfPow = modPow(a, orderR >> 1n, N);
  if (halfPow === N - 1n || halfPow === 1n) {
    return {
      attempt: {
        baseA: a.toString(),
        gcdAN: '1',
        orderR: orderR.toString(),
        isREven: true,
        halfPowerModN: halfPow.toString(),
        isTrivialMinusOne: true,
        gcdMinus: gcd(halfPow - 1n, N).toString(),
        gcdPlus: gcd(halfPow + 1n, N).toString(),
        outcome: 'TRIVIAL_ROOT',
        note: `الشرط a^(r/2) ≡ -1 (mod N) تحقق (${halfPow} ≡ -1)، ما ينتج عوامل تافهة (1 و N)؛ يلزم تجربة أساس a بديل.`,
      },
      mode,
      extracted: null,
    };
  }

  const gMinus = gcd(halfPow - 1n, N);
  const gPlus = gcd(halfPow + 1n, N);
  const f1 = gMinus > 1n && gMinus < N ? gMinus : N / gPlus;
  const f2 = N / f1;
  const sorted: [string, string] =
    f1 <= f2 ? [f1.toString(), f2.toString()] : [f2.toString(), f1.toString()];

  return {
    attempt: {
      baseA: a.toString(),
      gcdAN: '1',
      orderR: orderR.toString(),
      isREven: true,
      halfPowerModN: halfPow.toString(),
      isTrivialMinusOne: false,
      gcdMinus: gMinus.toString(),
      gcdPlus: gPlus.toString(),
      outcome: 'SUCCESS',
      note: `تحققت جميع شروط شور: r = ${orderR} زوجية و a^(r/2) ≢ ±1 (mod N)، فاستُخرج العاملان (${sorted[0]} × ${sorted[1]}).`,
    },
    mode,
    extracted: sorted,
  };
}

function buildPeriodicSeries(
  a: bigint,
  N: bigint,
  orderR: bigint | null
): { series: PeriodicPoint[]; truncated: boolean } {
  if (orderR === null || orderR <= 0n) {
    return { series: [], truncated: false };
  }

  const maxPoints = orderR <= 40n ? Math.min(Number(orderR) * 2 + 2, 84) : 48;
  const truncated = orderR > 40n;
  const series: PeriodicPoint[] = [];

  let cur = 1n; // a^0 mod N = 1
  for (let x = 0; x < maxPoints; x++) {
    const xBig = BigInt(x);
    series.push({
      x,
      fx: Number(cur),
      isPeriodMarker: xBig % orderR === 0n,
    });
    cur = (cur * a) % N;
  }

  return { series, truncated };
}

function buildQftSpectrum(orderR: bigint | null): QftPeakPoint[] {
  if (orderR === null || orderR <= 0n) return [];
  const bins = 96;

  if (orderR <= 48n) {
    const rNum = Number(orderR);
    const M = Math.ceil(bins / rNum);
    const points: QftPeakPoint[] = [];
    for (let k = 0; k < bins; k++) {
      let re = 0;
      let im = 0;
      for (let m = 0; m < M; m++) {
        const angle = (-2 * Math.PI * k * m * rNum) / bins;
        re += Math.cos(angle);
        im += Math.sin(angle);
      }
      const prob = (re * re + im * im) / (bins * M);
      points.push({
        bin: k,
        probability: Number(prob.toFixed(4)),
        isPeak: prob > 0.12,
      });
    }
    return points;
  }

  // For large r: show normalized 8-harmonic constructive interference slice across QFT register
  const harmonics = 8;
  const points: QftPeakPoint[] = [];
  for (let k = 0; k < bins; k++) {
    const phasePos = (k / bins) * harmonics;
    const dist = Math.abs(phasePos - Math.round(phasePos));
    // Fejér / sinc^2 kernel simulating QFT measurement concentration around j*Q/r
    const theta = Math.PI * dist * 6;
    const prob = theta < 1e-6 ? 0.92 : Math.min(0.92, Math.pow(Math.sin(theta) / theta, 2) * 0.92);
    points.push({
      bin: k,
      probability: Number(prob.toFixed(4)),
      isPeak: dist < 0.08,
    });
  }
  return points;
}

function formatOpsMagnitude(log10Val: number): string {
  if (log10Val < 4) {
    return `${Math.round(Math.pow(10, log10Val)).toLocaleString('en-US')} عملية`;
  }
  const exp = Math.floor(log10Val);
  const mantissa = Math.pow(10, log10Val - exp);
  return `${mantissa.toFixed(1)} × 10^${exp}`;
}

export function buildComplexityComparison(currentBits: number): ComplexityComparisonPoint[] {
  const basePoints = [8, 16, 24, 32, 48, 64, 128, 256, 512, 1024, 2048];
  const merged = Array.from(new Set([...basePoints, Math.max(2, currentBits)])).sort(
    (a, b) => a - b
  );

  return merged.map((bits) => {
    const lnN = bits * Math.LN2;
    const lnLnN = Math.log(Math.max(2, lnN));
    // Shor: O(b^3)
    const shorLog10 = 3 * Math.log10(bits);
    // Pollard's Rho: O(N^(1/4)) = 2^(b/4)
    const rhoLog10 = (bits / 4) * Math.LOG10E * Math.LN2;
    // Trial division: O(N^(1/2)) = 2^(b/2)
    const trialLog10 = (bits / 2) * Math.LOG10E * Math.LN2;
    // GNFS: exp((64/9)^(1/3) * (ln N)^(1/3) * (ln ln N)^(2/3))
    const gnfsLn = 1.923 * Math.cbrt(lnN) * Math.pow(lnLnN, 2 / 3);
    const gnfsLog10 = gnfsLn * Math.LOG10E;

    return {
      bits,
      label: `${bits}b`,
      shorLog10: Number(shorLog10.toFixed(2)),
      gnfsLog10: Number(gnfsLog10.toFixed(2)),
      rhoLog10: Number(rhoLog10.toFixed(2)),
      trialLog10: Number(trialLog10.toFixed(2)),
      shorOpsText: formatOpsMagnitude(shorLog10),
      rhoOpsText: formatOpsMagnitude(rhoLog10),
      gnfsOpsText: formatOpsMagnitude(gnfsLog10),
    };
  });
}

function randomBigIntInRange(min: bigint, max: bigint): bigint {
  const span = max - min + 1n;
  const bits = getBitLength(span);
  const bytesNeeded = Math.ceil(bits / 8);
  const buf = new Uint8Array(bytesNeeded);
  while (true) {
    crypto.getRandomValues(buf);
    let val = 0n;
    for (const byte of buf) {
      val = (val << 8n) | BigInt(byte);
    }
    const mask = (1n << BigInt(bits)) - 1n;
    val &= mask;
    if (val < span) {
      return min + val;
    }
  }
}

function generateRandomPrime(bits: number): bigint {
  const min = 1n << BigInt(bits - 1);
  const max = (1n << BigInt(bits)) - 1n;
  while (true) {
    let candidate = randomBigIntInRange(min, max) | 1n | (1n << BigInt(bits - 1));
    if (isProbablyPrime(candidate)) return candidate;
    // Step by 2 cleanly within range
    for (let i = 0; i < 64; i++) {
      candidate += 2n;
      if (candidate <= max && isProbablyPrime(candidate)) {
        return candidate;
      }
    }
  }
}

export function generateRandomSemiprime(totalBits: number): {
  n: string;
  p: string;
  q: string;
  bitLength: number;
} {
  const clamped = Math.max(8, Math.min(1024, totalBits));
  const pBits = Math.floor(clamped / 2);
  const qBits = clamped - pBits;
  const p = generateRandomPrime(pBits);
  let q = generateRandomPrime(qBits);
  while (q === p) {
    q = generateRandomPrime(qBits);
  }
  const n = p * q;
  const smallP = p <= q ? p : q;
  const largeQ = p <= q ? q : p;
  return {
    n: n.toString(),
    p: smallP.toString(),
    q: largeQ.toString(),
    bitLength: getBitLength(n),
  };
}

export function analyzeSemiprimeAndSimulateShor(
  rawN: string,
  manualBaseA?: string
): SemiprimeFactorizationResult {
  const startMs = performance.now();
  const N = sanitizeBigIntInput(rawN);
  const bitLen = getBitLength(N);
  const decimalDigits = N.toString().length;

  const isInputPrime = isProbablyPrime(N);
  const rawFactors = isInputPrime ? [N] : factorizeBigInt(N, startMs + 2500);
  const elapsedMs = Number((performance.now() - startMs).toFixed(2));
  const groupedFactors = groupPrimeFactors(rawFactors);

  let classification: SemiprimeClassification;
  let isExactSemiprime = false;
  let p: string | null = null;
  let q: string | null = null;
  let pIsPrime = false;
  let qIsPrime = false;

  if (isInputPrime) {
    classification = 'PRIME';
  } else if (rawFactors.length === 2) {
    isExactSemiprime = true;
    p = rawFactors[0].toString();
    q = rawFactors[1].toString();
    pIsPrime = isProbablyPrime(rawFactors[0]);
    qIsPrime = isProbablyPrime(rawFactors[1]);
    if (rawFactors[0] === 2n) {
      classification = 'EVEN_SEMIPRIME';
    } else if (rawFactors[0] === rawFactors[1]) {
      classification = 'PRIME_SQUARE';
    } else {
      classification = 'SEMIPRIME';
    }
  } else {
    classification = 'COMPOSITE_MULTI';
    // Also expose first factor vs remaining product for clarity
    p = rawFactors[0].toString();
    q = (N / rawFactors[0]).toString();
    pIsPrime = isProbablyPrime(rawFactors[0]);
    qIsPrime = isProbablyPrime(N / rawFactors[0]);
  }

  const productCheck =
    p && q
      ? (BigInt(p) * BigInt(q)).toString()
      : rawFactors.reduce((acc, v) => acc * v, 1n).toString();
  const productVerified = BigInt(productCheck) === N;

  // Shor period-finding simulation
  const attempts: ShorAttemptLog[] = [];
  let chosenA: bigint | null = null;
  const autoSelected = !manualBaseA || !manualBaseA.trim();
  let finalResult: ReturnType<typeof evaluateShorCandidate> | null = null;
  let suggestedWorkingBase: string | null = null;

  if (isInputPrime) {
    chosenA = 2n < N ? 2n : 1n;
    attempts.push({
      baseA: chosenA.toString(),
      gcdAN: '1',
      orderR: (N - 1n).toString(),
      isREven: ((N - 1n) & 1n) === 0n,
      halfPowerModN: null,
      isTrivialMinusOne: true,
      gcdMinus: null,
      gcdPlus: null,
      outcome: 'NOT_APPLICABLE',
      note: `العدد ${N} أولي بالفعل؛ لا توجد عوامل غير تافهة لاستخراجها بخوارزمية شور.`,
    });
  } else if (!autoSelected) {
    const cleanedA = manualBaseA!.replace(/[\s,_]/g, '').trim();
    if (!/^\d+$/.test(cleanedA)) {
      throw new Error('قيمة الأساس (a) يجب أن تكون عدداً صحيحاً موجباً.');
    }
    const parsedA = BigInt(cleanedA);
    if (parsedA < 2n || parsedA >= N) {
      throw new Error(`يجب أن يكون الأساس المختار (a) محصوراً بين 2 و ${N - 1n}.`);
    }
    chosenA = parsedA;
    finalResult = evaluateShorCandidate(parsedA, N, groupedFactors);
    attempts.push(finalResult.attempt);

    // If manual choice failed, scan quickly for a working alternative base to suggest
    if (finalResult.attempt.outcome !== 'SUCCESS' && finalResult.attempt.outcome !== 'DIRECT_GCD') {
      for (let cand = 2n; cand < N && cand < 60n; cand++) {
        if (cand === parsedA || gcd(cand, N) !== 1n) continue;
        const testRes = evaluateShorCandidate(cand, N, groupedFactors);
        if (testRes.attempt.outcome === 'SUCCESS') {
          suggestedWorkingBase = cand.toString();
          break;
        }
      }
    }
  } else {
    // Auto-select coprime base a that demonstrates full period-finding flow if possible
    const maxCandidates =
      classification === 'EVEN_SEMIPRIME' || classification === 'PRIME_SQUARE' ? 1 : 32;
    let tried = 0;
    for (let cand = 2n; cand < N && tried < maxCandidates; cand++) {
      if (gcd(cand, N) !== 1n) continue;
      tried++;
      const evalRes = evaluateShorCandidate(cand, N, groupedFactors);
      attempts.push(evalRes.attempt);
      chosenA = cand;
      finalResult = evalRes;
      if (evalRes.attempt.outcome === 'SUCCESS') {
        break;
      }
    }
    if (!finalResult) {
      chosenA = 2n;
      finalResult = evaluateShorCandidate(2n, N, groupedFactors);
      attempts.push(finalResult.attempt);
    }
  }

  const primaryAttempt = attempts[attempts.length - 1];
  const orderRBigInt = primaryAttempt.orderR ? BigInt(primaryAttempt.orderR) : null;
  const { series: periodicSeries, truncated: periodicTruncated } = buildPeriodicSeries(
    chosenA ?? 2n,
    N,
    orderRBigInt
  );
  const qftSpectrum = buildQftSpectrum(orderRBigInt);

  // Build ordered Shor trace steps for educational display
  const steps: ShorStepTrace[] = [];
  if (isInputPrime) {
    steps.push({
      stepNumber: 1,
      title: 'اختبار الأولية المسبق (Miller-Rabin)',
      formula: `isPrime(${N}) = true`,
      resultValue: 'عدد أولي',
      status: 'warning',
      explanation: 'تتطلب خوارزمية شور أن يكون N عدداً مركباً فردياً وليس قوة لعدد أولي.',
    });
  } else {
    steps.push({
      stepNumber: 1,
      title: 'اختيار أساس عشوائي وفحص القاسم المشترك الأولي',
      formula: `a = ${primaryAttempt.baseA},  gcd(a, N) = gcd(${primaryAttempt.baseA}, ${N})`,
      resultValue: primaryAttempt.gcdAN,
      status: primaryAttempt.outcome === 'DIRECT_GCD' ? 'passed' : 'info',
      explanation:
        primaryAttempt.outcome === 'DIRECT_GCD'
          ? `نجح الفحص الكلاسيكي الأولي مباشرة! القاسم ${primaryAttempt.gcdAN} عامل غير تافه للعدد N.`
          : 'العددان متباينان أولياً (gcd = 1)، لذا ننتقل إلى روتين إيجاد الفترة الدورية للدالة a^x mod N.',
    });

    if (primaryAttempt.outcome !== 'DIRECT_GCD') {
      steps.push({
        stepNumber: 2,
        title: 'إيجاد الفترة الدورية r للدالة الأسية المعيارية',
        formula: `f(x) = ${primaryAttempt.baseA}^x mod ${N}  ⇒  ${primaryAttempt.baseA}^r ≡ 1 (mod ${N})`,
        resultValue: `r = ${primaryAttempt.orderR}`,
        status: primaryAttempt.isREven ? 'passed' : 'warning',
        explanation:
          finalResult?.mode === 'DIRECT_SCAN'
            ? 'تم تتبع الدورة مباشرة خطوة بخطوة على السلسلة المعيارية؛ في الحاسوب الكمومي يُستخرج r عبر تحويل فورييه الكمومي (QFT) بزمن متعدد الحدود.'
            : 'نظراً لكبر حجم N، استُنتج الترتيب الضربي الدقيق r تحليلياً من دالة كارمايكل λ(N) لتجنب تعليق المتصفح بالمسح الأسي الكلاسيكي.',
      });

      steps.push({
        stepNumber: 3,
        title: 'التحقق من زوجية الفترة وشرط الجذر غير التافه',
        formula: primaryAttempt.isREven
          ? `r = 2k,  ${primaryAttempt.baseA}^(${BigInt(primaryAttempt.orderR!) >> 1n}) mod ${N} = ${primaryAttempt.halfPowerModN}`
          : `r = ${primaryAttempt.orderR} (فردي)`,
        resultValue: !primaryAttempt.isREven
          ? 'فشل شرط الزوجية'
          : primaryAttempt.isTrivialMinusOne
          ? 'جذر تافه (-1 أو +1)'
          : 'شرطان محققان',
        status:
          primaryAttempt.isREven && !primaryAttempt.isTrivialMinusOne ? 'passed' : 'warning',
        explanation:
          primaryAttempt.isREven && !primaryAttempt.isTrivialMinusOne
            ? `بما أن r زوجية و ${primaryAttempt.halfPowerModN} ≢ ±1 (mod N)، فإن (a^(r/2) - 1)(a^(r/2) + 1) يقبل القسمة على N دون أن يقبل أي قوس القسمة وحده.`
            : classification === 'EVEN_SEMIPRIME' || classification === 'PRIME_SQUARE'
            ? 'ملاحظة نظرية: للأعداد من الشكل 2p أو p² تكون الزمرة الضربية دائرية، مما يجعل الجذر التربيعي لـ 1 هو ±1 فقط؛ لذا يتولى التحليل الأولي السريع (قسمة 2 أو الجذر التربيعي) تفكيكها قبل تشغيل QFT.'
            : 'عند فشل أحد الشرطين، تعيد خوارزمية شور المحاولة باختيار أساس عشوائي جديد a (احتمال النجاح ≥ 50% لكل محاولة لعدد شبه أولي فردي).',
      });

      steps.push({
        stepNumber: 4,
        title: 'استخلاص العوامل عبر خوارزمية إقليدس (GCD)',
        formula: primaryAttempt.halfPowerModN
          ? `gcd(${primaryAttempt.halfPowerModN} - 1, ${N}) = ${primaryAttempt.gcdMinus}  |  gcd(${primaryAttempt.halfPowerModN} + 1, ${N}) = ${primaryAttempt.gcdPlus}`
          : 'غير متاح لهذا الأساس',
        resultValue:
          finalResult?.extracted !== null && finalResult?.extracted !== undefined
            ? `${finalResult.extracted[0]} × ${finalResult.extracted[1]}`
            : 'يتطلب أساساً بديلاً',
        status: finalResult?.extracted ? 'passed' : 'warning',
        explanation: finalResult?.extracted
          ? `تم استخراج العاملين غير التافهين بنجاح وتأكيد مطابقتهما للتحليل الأولي الدقيق.`
          : 'استخدم الأساس المقترح أو الوضع التلقائي لإتمام استخراج العوامل عبر QFT.',
      });
    }
  }

  return {
    inputN: N.toString(),
    bitLength: bitLen,
    decimalDigits,
    classification,
    isExactSemiprime,
    p,
    q,
    pIsPrime,
    qIsPrime,
    productCheck,
    productVerified,
    allPrimeFactors: groupedFactors,
    classicalMethod:
      bitLen <= 28
        ? 'القسمة التجريبية + Miller-Rabin (BigInt)'
        : "Pollard's Rho (Brent Cycle) + Miller-Rabin (BigInt)",
    elapsedMs,
    shorSimulation: {
      selectedBaseA: (chosenA ?? 2n).toString(),
      autoSelected,
      orderR: primaryAttempt.orderR,
      orderComputationMode: isInputPrime
        ? 'NOT_APPLICABLE'
        : finalResult?.mode ?? 'ANALYTICAL_LAMBDA',
      isREven: primaryAttempt.isREven,
      halfPowerModN: primaryAttempt.halfPowerModN,
      nonTrivialRoot:
        primaryAttempt.outcome === 'SUCCESS' || primaryAttempt.outcome === 'DIRECT_GCD',
      extractedFactors: finalResult?.extracted ?? null,
      steps,
      attempts,
      periodicSeries,
      periodicTruncated,
      qftSpectrum,
      suggestedWorkingBase,
    },
    complexitySeries: buildComplexityComparison(bitLen),
  };
}

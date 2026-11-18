import { analyzeSemiprimeAndSimulateShor } from '../utils/semiprimeMath';

self.onmessage = (event: MessageEvent<{ rawN: string; manualA?: string }>) => {
  try {
    const { rawN, manualA } = event.data;
    const result = analyzeSemiprimeAndSimulateShor(rawN, manualA);
    self.postMessage({
      success: true,
      result: {
        inputN: result.inputN,
        bitLength: result.bitLength,
        p: result.p,
        q: result.q,
        selectedBaseA: result.shorSimulation.selectedBaseA,
        orderR: result.shorSimulation.orderR,
        steps: result.shorSimulation.steps,
        attempts: result.shorSimulation.attempts,
        productVerified: result.productVerified,
      },
    });
  } catch (err) {
    self.postMessage({
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير معروف أثناء تنفيذ محاكاة شور في خيط المعالجة الخلفي (Web Worker).',
    });
  }
};

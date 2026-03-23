/**
 * Frontend timing instrumentation.
 * Usage:
 *   import { timePage, timeCall } from '@/lib/timing';
 *   const t = timePage('Home');
 *   const orders = await timeCall(t, 'getTenantOrders', () => base44.functions.invoke(...));
 *   t.done();
 */

const ENABLED = true; // set false to silence in prod

export function timePage(pageName) {
  const pageStart = performance.now();
  const calls = [];

  function timeCall(label, fn) {
    const start = performance.now();
    const result = fn();
    // Handle both promise and sync
    if (result && typeof result.then === 'function') {
      return result.then(val => {
        const ms = Math.round(performance.now() - start);
        calls.push({ label, ms });
        if (ENABLED) console.log(`[TIMING] ${pageName} | ${label}: ${ms}ms`);
        return val;
      }).catch(err => {
        const ms = Math.round(performance.now() - start);
        calls.push({ label, ms, error: true });
        if (ENABLED) console.log(`[TIMING] ${pageName} | ${label}: ${ms}ms (ERROR)`);
        throw err;
      });
    }
    const ms = Math.round(performance.now() - start);
    calls.push({ label, ms });
    return result;
  }

  function done(note) {
    if (!ENABLED) return;
    const total = Math.round(performance.now() - pageStart);
    const sorted = [...calls].sort((a, b) => b.ms - a.ms);
    console.groupCollapsed(`[TIMING REPORT] ${pageName} — total: ${total}ms${note ? ` (${note})` : ''}`);
    sorted.forEach(c => {
      const bar = '█'.repeat(Math.min(40, Math.round(c.ms / 50)));
      console.log(`  ${c.label.padEnd(35)} ${String(c.ms).padStart(5)}ms  ${bar}${c.error ? ' ❌' : ''}`);
    });
    console.log(`  ${'TOTAL'.padEnd(35)} ${String(total).padStart(5)}ms`);
    console.groupEnd();
  }

  return { timeCall, done, calls, pageName, pageStart };
}

// Convenience: wrap a Promise and log its duration
export function timeCall(timer, label, fn) {
  return timer.timeCall(label, fn);
}
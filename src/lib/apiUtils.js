/**
 * Rate-limit aware API utilities.
 * Wraps base44.functions.invoke with exponential backoff on 429 errors.
 */
import { base44 } from '@/api/base44Client';

/**
 * Invoke a backend function with automatic retry on 429 rate-limit errors.
 * @param {string} fnName - Backend function name
 * @param {object} payload - Request payload
 * @param {object} opts - Options: maxRetries (default 3), baseDelay (default 800ms)
 */
export async function invokeWithRetry(fnName, payload = {}, { maxRetries = 3, baseDelay = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await base44.functions.invoke(fnName, payload);
      return res;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status || err?.status;
      const isRateLimit = status === 429 || (err?.message || '').includes('429') || (err?.message || '').toLowerCase().includes('rate limit');
      if (isRateLimit && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
        console.warn(`[apiUtils] 429 on ${fnName}, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Run an array of async tasks sequentially (one at a time) to avoid burst rate limiting.
 * @param {Array<() => Promise>} tasks
 * @param {number} delayBetween - ms between each task (default 0)
 */
export async function runSequentially(tasks, delayBetween = 0) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
    if (delayBetween > 0 && tasks.indexOf(task) < tasks.length - 1) {
      await new Promise(r => setTimeout(r, delayBetween));
    }
  }
  return results;
}

/**
 * Run tasks in controlled batches to limit simultaneous requests.
 * @param {Array<() => Promise>} tasks
 * @param {number} batchSize - Max concurrent tasks per batch (default 3)
 * @param {number} delayBetweenBatches - ms between batches (default 200)
 */
export async function runInBatches(tasks, batchSize = 3, delayBetweenBatches = 200) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);
    if (i + batchSize < tasks.length && delayBetweenBatches > 0) {
      await new Promise(r => setTimeout(r, delayBetweenBatches));
    }
  }
  return results;
}
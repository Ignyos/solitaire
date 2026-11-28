/** @module Bounded retries for durable saves */

const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

/**
 * @template T
 * @param {() => Promise<T>} save
 * @param {(error: unknown) => boolean} isNonRetryable
 * @returns {Promise<T>}
 */
export async function saveWithRetries(save, isNonRetryable) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await save();
    } catch (error) {
      if (isNonRetryable(error) || attempt === RETRY_COUNT) throw error;
      console.warn('Saving failed; retrying the transaction:', error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

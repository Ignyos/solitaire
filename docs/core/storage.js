/** @module IndexedDB connection and transaction handling */

export const SETTINGS_STORE = 'settings';
export const APPLICATION_STORE = 'application';
const DATABASE_NAME = 'solitaire';
const DATABASE_VERSION = 1;

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

/**
 * @param {{ name?: string, gameStores: Array<{ name: string, upgrade: (database: IDBDatabase, transaction: IDBTransaction, oldVersion: number) => void }> }} options
 * @returns {Promise<IDBDatabase>}
 */
export function openStorage({ name = DATABASE_NAME, gameStores }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    let abandoned = false;
    request.addEventListener('upgradeneeded', event => {
      if (abandoned) {
        request.transaction.abort();
        return;
      }
      const database = request.result;
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE);
      }
      if (!database.objectStoreNames.contains(APPLICATION_STORE)) {
        database.createObjectStore(APPLICATION_STORE);
      }
      for (const store of gameStores) {
        store.upgrade(database, request.transaction, event.oldVersion);
      }
    });
    request.addEventListener('blocked', () => {
      abandoned = true;
      reject(new Error('Opening the game database was blocked.'));
    }, { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('success', () => {
      if (abandoned) request.result.close();
      else resolve(request.result);
    }, { once: true });
  });
}

/**
 * The callback may await IndexedDB requests, but not unrelated asynchronous work.
 * @template T
 * @param {IDBDatabase} database
 * @param {string[]} stores
 * @param {IDBTransactionMode} mode
 * @param {(transaction: IDBTransaction) => Promise<T>} action
 * @returns {Promise<T>}
 */
export async function withTransaction(database, stores, mode, action) {
  const transaction = database.transaction(stores, mode);
  const completion = new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
  });
  try {
    const result = await action(transaction);
    await completion;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch (abortError) {
      if (!(abortError instanceof DOMException) || abortError.name !== 'InvalidStateError') {
        throw abortError;
      }
    }
    try {
      await completion;
    } catch (transactionError) {
      if (transactionError && transactionError !== error) {
        console.error('IndexedDB transaction also failed:', transactionError);
      }
    }
    throw error;
  }
}

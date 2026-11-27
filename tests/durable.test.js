import { shuffledDeck, fingerprintDeal } from '../docs/cards/deck.js';
import { openStorage, requestResult, withTransaction } from '../docs/core/storage.js';
import { readLastRoute, saveLastRoute } from '../docs/core/navigation-context.js';
import { saveWithRetries } from '../docs/core/save-coordinator.js';
import {
  KLONDIKE_STORE, upgradeKlondikeStore, createAttempt, readActiveAttempt,
  checkpointAttempt, forfeitAttempt, AttemptStateError
} from '../docs/games/klondike/store.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejectsWith(action, ErrorType) {
  try {
    await action();
  } catch (error) {
    if (error instanceof ErrorType) return;
    throw error;
  }
  throw new Error(`Expected ${ErrorType.name}.`);
}

const name = `solitaire-test-${crypto.randomUUID()}`;
const database = await openStorage({
  name, gameStores: [{ name: KLONDIKE_STORE, upgrade: upgradeKlondikeStore }]
});

const tests = [
  {
    name: 'Generates a complete deck and a stable, deal-specific fingerprint',
    async run() {
      const deck = shuffledDeck();
      assert(deck.length === 52, 'Expected 52 cards.');
      assert(new Set(deck.map(card => `${card.suit}:${card.rank}`)).size === 52,
        'Expected each card exactly once.');
      const fingerprint = await fingerprintDeal(deck, 1);
      assert(fingerprint.length === 64, 'Expected a SHA-256 fingerprint.');
      assert(fingerprint === await fingerprintDeal(deck, 1), 'Fingerprint changed for the same deal.');
      assert(fingerprint !== await fingerprintDeal(deck, 2), 'Dealing version must affect the fingerprint.');
    }
  },
  {
    name: 'Creates and restores a durable initial attempt without an ownership record',
    async run() {
      const cards = shuffledDeck();
      const fingerprint = await fingerprintDeal(cards, 1);
      const attempt = await createAttempt(database, {
        attemptId: 'first', cards, fingerprint, replace: null
      });
      assert(attempt.dealNumber === 1 && attempt.options.draw === 1, 'Wrong deal or default option.');
      assert(attempt.board.tableau.length === 7 && attempt.board.stock.length === 24, 'Wrong board.');
      const restored = await readActiveAttempt(database);
      assert(restored.id === 'first' && restored.outcome === 'unfinished', 'Attempt was not restored.');
      const deal = await withTransaction(database, [KLONDIKE_STORE], 'readonly', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).get(['deal', 'standard', 1])));
      assert(JSON.stringify(deal.cards) === JSON.stringify(cards), 'Original card order was not saved.');
      assert(deal.fingerprint === fingerprint, 'Fingerprint was not saved.');
    }
  },
  {
    name: 'Preserves checkpoints and atomically forfeits a confirmed replacement',
    async run() {
      const cards = shuffledDeck();
      const fingerprint = await fingerprintDeal(cards, 1);
      await rejectsWith(() => createAttempt(database, {
        attemptId: 'second', cards, fingerprint, replace: null
      }), AttemptStateError);
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
        const store = transaction.objectStore(KLONDIKE_STORE);
        const old = await requestResult(store.get(['attempt', 'first']));
        old.revision = 7;
        await requestResult(store.put(old, ['attempt', 'first']));
      });
      await checkpointAttempt(database, { id: 'first', elapsedMs: 12000 });
      const next = await createAttempt(database, {
        attemptId: 'second', cards, fingerprint,
        replace: { id: 'first', elapsedMs: 14000 }
      });
      const old = await withTransaction(database, [KLONDIKE_STORE], 'readonly', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).get(['attempt', 'first'])));
      assert(old.outcome === 'forfeit' && old.elapsedMs === 14000 && old.moves === 0,
        'Forfeit did not preserve the final stats.');
      assert(next.dealNumber === 2 && (await readActiveAttempt(database)).id === 'second',
        'Replacement was not saved.');
      await rejectsWith(() => checkpointAttempt(database, { id: 'first', elapsedMs: 15000 }),
        AttemptStateError);
    }
  },
  {
    name: 'Saves routes and forfeits an active attempt without an ownership record',
    async run() {
      await saveLastRoute(database, '#/home');
      assert(await readLastRoute(database) === '#/home', 'Route was not saved.');
      await checkpointAttempt(database, { id: 'second', elapsedMs: 5000 });
      await forfeitAttempt(database, { id: 'second', elapsedMs: 6000 });
      assert(await readActiveAttempt(database) === null, 'Forfeited attempt is still active.');
      assert(await readLastRoute(database) === '#/games/klondike', 'Forfeit route was not saved.');
      const attempt = await withTransaction(database, [KLONDIKE_STORE], 'readonly', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).get(['attempt', 'second'])));
      assert(attempt.outcome === 'forfeit' && attempt.elapsedMs === 6000,
        'Forfeit did not preserve the elapsed time.');
    }
  },
  {
    name: 'Retries transient save failures and surfaces invalid attempt states',
    async run() {
      let attempts = 0;
      const saved = await saveWithRetries(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('Temporary save failure.');
        return 'saved';
      }, error => error instanceof AttemptStateError);
      assert(saved === 'saved' && attempts === 2, 'Transient failure was not retried.');
      attempts = 0;
      await rejectsWith(() => saveWithRetries(async () => {
        attempts += 1;
        throw new AttemptStateError();
      }, error => error instanceof AttemptStateError), AttemptStateError);
      assert(attempts === 1, 'Invalid attempt state was retried.');
    }
  }
];

const results = document.querySelector('#results');
let failures = 0;
try {
  for (const test of tests) {
    const item = document.createElement('li');
    try {
      await test.run();
      item.textContent = `PASS: ${test.name}`;
    } catch (error) {
      failures += 1;
      item.textContent = `FAIL: ${test.name}: ${error.message}`;
      console.error(`Test failed: ${test.name}`, error);
    }
    results.append(item);
  }
} finally {
  database.close();
  await requestResult(indexedDB.deleteDatabase(name));
}
const status = document.querySelector('#status');
status.textContent = failures === 0 ? `All ${tests.length} tests passed.` : `${failures} test(s) failed.`;
status.dataset.result = failures === 0 ? 'passed' : 'failed';

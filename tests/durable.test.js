import { shuffledDeck, fingerprintDeal } from '../docs/cards/deck.js';
import { openStorage, requestResult, withTransaction } from '../docs/core/storage.js';
import { readLastRoute, saveLastRoute } from '../docs/core/navigation-context.js';
import { saveWithRetries } from '../docs/core/save-coordinator.js';
import { readGameSettings, saveGameOption, saveOptionsDisplay } from '../docs/core/game-settings.js';
import { games } from '../docs/games/registry.js';
import {
  KLONDIKE_STORE, upgradeKlondikeStore, createAttempt, readActiveAttempt, readFinishedDeals,
  retryAttempt, checkpointAttempt, readLastUndo, applyAttemptAction, undoAttemptAction, forfeitAttempt, AttemptStateError
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
const game = games.find(entry => entry.id === 'klondike');
if (!game) throw new Error('Klondike is missing from the game registry.');

const tests = [
  {
    name: 'Persists game options and display preference independently per game',
    async run() {
      const defaults = await readGameSettings(database, game);
      assert(defaults.options.draw === 1 && defaults.showOptions, 'Wrong first-play defaults.');
      await saveGameOption(database, game, 'draw', 3);
      await saveOptionsDisplay(database, game.id, false);
      const saved = await readGameSettings(database, game);
      const other = await readGameSettings(database, { ...game, id: 'another-game' });
      assert(saved.options.draw === 3 && !saved.showOptions, 'Settings were not saved.');
      assert(other.options.draw === 1 && other.showOptions, 'Settings leaked to another game.');
      await rejectsWith(() => saveGameOption(database, game, 'draw', 2), TypeError);
      await saveGameOption(database, game, 'draw', 1);
      await saveOptionsDisplay(database, game.id, true);
    }
  },
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
      assert((await readFinishedDeals(database)).length === 0, 'Unfinished deals must not appear in Retry.');
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
    name: 'Retries a finished deal with its original layout and options',
    async run() {
      const history = await readFinishedDeals(database);
      assert(history.length === 2, 'Expected one entry for each finished deal.');
      const first = history.find(entry => entry.latest.id === 'first');
      assert(first && first.attemptCount === 1 && first.latest.elapsedMs === 14000,
        'The finished deal summary is incorrect.');
      await withTransaction(database, ['settings'], 'readwrite', async transaction => {
        await requestResult(transaction.objectStore('settings').put(3, ['klondike', 'draw']));
      });
      const retried = await retryAttempt(database, {
        attemptId: 'retry-first', sourceAttemptId: 'first', replace: null
      });
      assert(retried.dealNumber === 1 && retried.options.draw === 1,
        'Retry changed the deal identity or its original option.');
      assert(JSON.stringify(retried.board) === JSON.stringify(first.latest.board),
        'Retry did not reproduce the original layout.');
      assert(retried.moves === 0 && retried.score === 0 && retried.elapsedMs === 0,
        'Retry did not reset the attempt statistics.');
      const updated = (await readFinishedDeals(database)).find(entry => entry.latest.id === 'first');
      assert(updated.attemptCount === 2, 'Attempt count must include an unfinished retry.');
      assert(await readLastRoute(database) === '#/games/klondike/attempts/retry-first',
        'Retry route was not saved.');
    }
  },
  {
    name: 'Atomically replaces the active attempt when retrying',
    async run() {
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
        const store = transaction.objectStore(KLONDIKE_STORE);
        const active = await requestResult(store.get(['attempt', 'retry-first']));
        active.moves = 5;
        active.score = 20;
        await requestResult(store.put(active, ['attempt', 'retry-first']));
        const source = await requestResult(store.get(['attempt', 'second']));
        source.options.draw = 3;
        await requestResult(store.put(source, ['attempt', 'second']));
      });
      await rejectsWith(() => retryAttempt(database, {
        attemptId: 'invalid-retry', sourceAttemptId: 'retry-first',
        replace: { id: 'retry-first', elapsedMs: 2000 }
      }), AttemptStateError);
      await rejectsWith(() => retryAttempt(database, {
        attemptId: 'retry-first', sourceAttemptId: 'second',
        replace: { id: 'retry-first', elapsedMs: 2000 }
      }), DOMException);
      const preserved = await readActiveAttempt(database);
      assert(preserved.id === 'retry-first' && preserved.outcome === 'unfinished',
        'A failed retry must not forfeit the active attempt.');
      const replacement = await retryAttempt(database, {
        attemptId: 'retry-second', sourceAttemptId: 'second',
        replace: { id: 'retry-first', elapsedMs: 2000 }
      });
      assert(replacement.dealNumber === 2 && replacement.options.draw === 3,
        'Retry did not use the selected finished deal.');
      const history = await readFinishedDeals(database);
      const first = history.find(entry => entry.latest.id === 'retry-first');
      const second = history.find(entry => entry.latest.id === 'second');
      assert(first && first.attemptCount === 2 && first.latest.elapsedMs === 2000 &&
        first.latest.moves === 5 && first.latest.score === 20,
        'Replacement did not preserve the latest finished result.');
      assert(second && second.attemptCount === 2 && (await readActiveAttempt(database)).id === 'retry-second',
        'Replacement or unfinished attempt count was not saved.');
    }
  },
  {
    name: 'Uses the saved draw option for a new deal',
    async run() {
      await saveGameOption(database, game, 'draw', 3);
      const cards = shuffledDeck();
      const fingerprint = await fingerprintDeal(cards, 1);
      const created = await createAttempt(database, {
        attemptId: 'draw-three', cards, fingerprint,
        replace: { id: 'retry-second', elapsedMs: 0 }
      });
      assert(created.options.draw === 3 && (await readActiveAttempt(database)).id === 'draw-three',
        'The new deal did not use the saved option.');
    }
  },
  {
    name: 'Persists action history, undo penalties, and timer checkpoints atomically',
    async run() {
      const initial = await readActiveAttempt(database);
      const first = await applyAttemptAction(database, {
        id: initial.id, elapsedMs: 1000, action: { type: 'draw' }
      });
      assert(first.board.waste.length === 3 && first.moves === 1, 'Draw-three was not saved.');
      const undoEntry = await readLastUndo(database, initial.id);
      assert(JSON.stringify(undoEntry?.board) === JSON.stringify(initial.board),
        'Undo availability did not expose the prior position.');
      await checkpointAttempt(database, { id: initial.id, elapsedMs: 2000 });
      const second = await applyAttemptAction(database, {
        id: initial.id, elapsedMs: 1500, action: { type: 'draw' }
      });
      assert(second.elapsedMs === 2000 && second.board.waste.length === 6,
        'Move overwrote the checkpoint or board.');
      const reopened = await openStorage({
        name, gameStores: [{ name: KLONDIKE_STORE, upgrade: upgradeKlondikeStore }]
      });
      try {
        assert((await readActiveAttempt(reopened)).board.waste.length === 6, 'Move was not durable.');
        const undone = await undoAttemptAction(reopened, { id: initial.id, elapsedMs: 3000 });
        assert(undone.board.waste.length === 3 && undone.score === -1 &&
          undone.moves === 3 && undone.elapsedMs === 3000, 'First Undo was incorrect.');
      } finally {
        reopened.close();
      }
      const undone = await undoAttemptAction(database, { id: initial.id, elapsedMs: 2500 });
      assert(JSON.stringify(undone.board) === JSON.stringify(initial.board) && undone.score === -2 &&
        undone.moves === 4 && undone.elapsedMs === 3000, 'Second Undo was incorrect.');
      assert(await readLastUndo(database, initial.id) === null, 'Undo must be unavailable when history is empty.');
      await rejectsWith(() => undoAttemptAction(database, { id: initial.id, elapsedMs: 3000 }),
        AttemptStateError);
      let illegal = false;
      try {
        await applyAttemptAction(database, {
          id: initial.id, elapsedMs: 3000,
          action: { type: 'move', from: { pile: 'waste' }, to: { pile: 'foundation', index: 0 } }
        });
      } catch (error) {
        if (error.name !== 'IllegalMoveError') throw error;
        illegal = true;
      }
      assert(illegal, 'An illegal move must be rejected.');
      assert((await readActiveAttempt(database)).moves === 4, 'Invalid actions changed the saved attempt.');
    }
  },
  {
    name: 'Rolls back failed writes and retains more than 100 undo steps',
    async run() {
      const id = 'draw-three';
      const before = await readActiveAttempt(database);
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).add({}, ['undo', id, before.moves + 1])));
      await rejectsWith(() => applyAttemptAction(database, {
        id, elapsedMs: 4000, action: { type: 'draw' }
      }), DOMException);
      assert(JSON.stringify(await readActiveAttempt(database)) === JSON.stringify(before),
        'A failed action transaction changed the saved attempt.');
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).delete(['undo', id, before.moves + 1])));
      for (let count = 0; count < 101; count += 1) {
        await applyAttemptAction(database, { id, elapsedMs: 4000, action: { type: 'draw' } });
      }
      for (let count = 0; count < 101; count += 1) {
        await undoAttemptAction(database, { id, elapsedMs: 4000 });
      }
      const restored = await readActiveAttempt(database);
      assert(JSON.stringify(restored.board) === JSON.stringify(before.board) &&
        restored.moves === before.moves + 202 && restored.score === before.score - 101,
      'Undo history was capped or restored the wrong state.');
    }
  },
  {
    name: 'Undo reverses additive and negative scores before applying its penalty',
    async run() {
      const id = 'draw-three';
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
        const store = transaction.objectStore(KLONDIKE_STORE);
        const attempt = await requestResult(store.get(['attempt', id]));
        attempt.board = {
          stock: [], waste: [],
          tableau: [[{ card: { suit: 'clubs', rank: 4 }, faceUp: false },
            { card: { suit: 'hearts', rank: 1 }, faceUp: true }],
          [{ card: { suit: 'clubs', rank: 2 }, faceUp: true }], [], [], [], [], []],
          foundations: [[], [], [], []]
        };
        attempt.score = 0;
        await requestResult(store.put(attempt, ['attempt', id]));
      });
      const action = { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 },
        to: { pile: 'foundation', index: 0 } };
      const moved = await applyAttemptAction(database, { id, elapsedMs: 4000, action });
      assert(moved.score === 2, 'Foundation move and reveal must both score.');
      const undone = await undoAttemptAction(database, { id, elapsedMs: 4000 });
      assert(undone.score === -1 && !undone.board.tableau[0][0].faceUp,
        'Undo did not reverse the +2 action and its reveal.');
      await applyAttemptAction(database, { id, elapsedMs: 4000, action });
      const back = await applyAttemptAction(database, {
        id, elapsedMs: 4000, action: { type: 'move',
          from: { pile: 'foundation', index: 0 }, to: { pile: 'tableau', index: 1 } }
      });
      const undoBack = await undoAttemptAction(database, { id, elapsedMs: 4000 });
      assert(undoBack.score === back.score, 'Undoing a -1 action should have a net zero score change.');
    }
  },
  {
    name: 'Finishing a game atomically records a win and removes undo history',
    async run() {
      const id = 'draw-three';
      const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
      await withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
        const store = transaction.objectStore(KLONDIKE_STORE);
        const attempt = await requestResult(store.get(['attempt', id]));
        attempt.board = {
          stock: [], waste: [{ card: { suit: 'spades', rank: 13 }, faceUp: true }],
          tableau: Array.from({ length: 7 }, () => []),
          foundations: suits.map(suit => Array.from({ length: suit === 'spades' ? 12 : 13 },
            (_, index) => ({ card: { suit, rank: index + 1 }, faceUp: true })))
        };
        await requestResult(store.put(attempt, ['attempt', id]));
      });
      const won = await applyAttemptAction(database, {
        id, elapsedMs: 5000,
        action: { type: 'move', from: { pile: 'waste' }, to: { pile: 'foundation', index: 3 } }
      });
      const history = await withTransaction(database, [KLONDIKE_STORE], 'readonly', transaction =>
        requestResult(transaction.objectStore(KLONDIKE_STORE).getAll(
          IDBKeyRange.bound(['undo', id], ['undo', id, []]))));
      assert(won.outcome === 'won' && won.elapsedMs === 5000 && Number.isFinite(won.finishedAt),
        'Winning result was not saved.');
      assert(history.length === 0 && await readActiveAttempt(database) === null &&
        await readLastRoute(database) === '#/games/klondike', 'Win did not clear active state and history.');
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

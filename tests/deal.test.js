import { dealKlondike } from '../docs/games/klondike/deal.js';

const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
const deck = suits.flatMap(suit =>
  Array.from({ length: 13 }, (_, index) => ({ suit, rank: index + 1 })));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameCard(actual, expected) {
  return actual.suit === expected.suit && actual.rank === expected.rank;
}

function assertInvalid(cardOrder) {
  let rejected = false;
  try {
    dealKlondike(cardOrder);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    rejected = true;
  }
  assert(rejected, 'Expected an invalid deck to be rejected.');
}

const tests = [
  {
    name: 'Deals rows into seven columns with only their top cards face up',
    run() {
      const { tableau, waste, foundations } = dealKlondike(deck);
      assert(tableau.length === 7, 'Expected seven columns.');
      assert(waste.length === 0, 'Expected an empty waste.');
      assert(foundations.length === 4 && foundations.every(pile => pile.length === 0),
        'Expected four empty foundations.');
      let dealt = 0;
      for (let row = 0; row < 7; row += 1) {
        for (let column = row; column < 7; column += 1) {
          const placed = tableau[column][row];
          assert(sameCard(placed.card, deck[dealt]), `Wrong card at ${row}, ${column}.`);
          assert(placed.faceUp === (row === column), `Wrong orientation at ${row}, ${column}.`);
          dealt += 1;
        }
      }
      assert(tableau.every((column, index) => column.length === index + 1),
        'Wrong tableau column lengths.');
    }
  },
  {
    name: 'Places the remaining cards face down in draw order',
    run() {
      const { stock } = dealKlondike(deck);
      assert(stock.length === 24, 'Expected 24 stock cards.');
      for (let index = 0; index < stock.length; index += 1) {
        const placed = stock[stock.length - 1 - index];
        assert(sameCard(placed.card, deck[28 + index]), `Wrong stock card at ${index}.`);
        assert(!placed.faceUp, `Stock card ${index} must be face down.`);
      }
    }
  },
  {
    name: 'Uses the supplied order without mutating or retaining its cards',
    run() {
      const reversed = deck.map(card => ({ ...card })).reverse();
      const original = JSON.stringify(reversed);
      const board = dealKlondike(reversed);
      assert(sameCard(board.tableau[0][0].card, reversed[0]), 'Supplied order was ignored.');
      board.tableau[0][0].card.rank = 99;
      board.stock[0].card.rank = 99;
      assert(JSON.stringify(reversed) === original, 'The input deck was changed.');
    }
  },
  {
    name: 'Rejects incomplete, duplicate, and invalid decks',
    run() {
      assertInvalid(deck.slice(1));
      assertInvalid([...deck.slice(0, -1), deck[0]]);
      assertInvalid([...deck.slice(0, -1), { suit: 'stars', rank: 1 }]);
      assertInvalid([...deck.slice(0, -1), { suit: 'spades', rank: 14 }]);
    }
  }
];

const results = document.querySelector('#results');
let failures = 0;
for (const test of tests) {
  const item = document.createElement('li');
  try {
    test.run();
    item.textContent = `PASS: ${test.name}`;
  } catch (error) {
    failures += 1;
    item.textContent = `FAIL: ${test.name}: ${error.message}`;
    console.error(`Test failed: ${test.name}`, error);
  }
  results.append(item);
}
const status = document.querySelector('#status');
status.textContent = failures === 0 ? `All ${tests.length} tests passed.` : `${failures} test(s) failed.`;
status.dataset.result = failures === 0 ? 'passed' : 'failed';

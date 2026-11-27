import { dealKlondike } from '../docs/games/klondike/deal.js';
import { applyKlondikeAction, findAutomaticMove, IllegalMoveError } from '../docs/games/klondike/moves.js';
import { createKlondikeBoard } from '../docs/games/klondike/view.js';

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

function placed(suit, rank, faceUp = true) {
  return { card: { suit, rank }, faceUp };
}

function emptyBoard() {
  return { stock: [], waste: [], tableau: Array.from({ length: 7 }, () => []),
    foundations: Array.from({ length: 4 }, () => []) };
}

function assertIllegal(board, action) {
  try {
    applyKlondikeAction(board, 1, action);
  } catch (error) {
    if (error instanceof IllegalMoveError) return;
    throw error;
  }
  throw new Error('Expected an illegal action to be rejected.');
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
  },
  {
    name: 'Draws up to the selected count and recycles in the original order',
    run() {
      const board = emptyBoard();
      board.stock = [placed('clubs', 1, false), placed('clubs', 2, false)];
      const original = JSON.stringify(board);
      const drawn = applyKlondikeAction(board, 3, { type: 'draw' });
      assert(drawn.board.waste.map(item => item.card.rank).join() === '2,1',
        'Draw order or partial draw is wrong.');
      assert(drawn.board.waste.every(item => item.faceUp), 'Drawn cards must face up.');
      const recycled = applyKlondikeAction(drawn.board, 3, { type: 'draw' });
      assert(JSON.stringify(recycled.board) === original, 'Recycle did not restore stock order.');
      assert(JSON.stringify(board) === original && drawn.scoreDelta === 0, 'Draw mutated input or scored.');
      assertIllegal(emptyBoard(), { type: 'draw' });
    }
  },
  {
    name: 'Moves tableau sequences and scores an automatic reveal',
    run() {
      const board = emptyBoard();
      board.tableau[0] = [placed('clubs', 2, false), placed('hearts', 7), placed('clubs', 6)];
      board.tableau[1] = [placed('spades', 8)];
      const original = JSON.stringify(board);
      const action = { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 },
        to: { pile: 'tableau', index: 1 } };
      const result = applyKlondikeAction(board, 1, action);
      assert(result.scoreDelta === 1 && result.board.tableau[0][0].faceUp &&
        result.board.tableau[1].length === 3, 'Sequence or reveal is wrong.');
      assert(JSON.stringify(board) === original, 'Move mutated the input.');
      assertIllegal(board, { ...action, to: { pile: 'tableau', index: 2 } });
      assertIllegal(board, { ...action, from: { pile: 'tableau', index: 0, cardIndex: 0 } });
      assertIllegal(board, { ...action, to: { pile: 'foundation', index: 0 } });
    }
  },
  {
    name: 'Enforces foundation, color and king rules and scores legal moves',
    run() {
      const board = emptyBoard();
      board.waste = [placed('clubs', 1)];
      const foundation = applyKlondikeAction(board, 1, {
        type: 'move', from: { pile: 'waste' }, to: { pile: 'foundation', index: 0 }
      });
      assert(foundation.scoreDelta === 1 && foundation.board.foundations[0].length === 1,
        'Waste to foundation did not score.');
      foundation.board.tableau[1] = [placed('hearts', 2)];
      const back = applyKlondikeAction(foundation.board, 1, {
        type: 'move', from: { pile: 'foundation', index: 0 }, to: { pile: 'tableau', index: 1 }
      });
      assert(back.scoreDelta === -1, 'Foundation return did not score -1.');
      assertIllegal(foundation.board, {
        type: 'move', from: { pile: 'foundation', index: 0 }, to: { pile: 'tableau', index: 2 }
      });
      board.waste = [placed('hearts', 13)];
      const king = applyKlondikeAction(board, 1, {
        type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 }
      });
      assert(king.scoreDelta === 1, 'Waste to empty tableau did not score.');
      board.tableau[0] = [placed('diamonds', 8)];
      board.waste = [placed('hearts', 7)];
      assertIllegal(board, { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } });
    }
  },
  {
    name: 'Automatic moves prefer foundations then the leftmost legal tableau',
    run() {
      const board = emptyBoard();
      board.waste = [placed('hearts', 1)];
      board.tableau[1] = [placed('clubs', 2)];
      assert(findAutomaticMove(board, 1, { pile: 'waste' }).to.pile === 'foundation',
        'An available foundation must take priority.');
      board.waste = [placed('hearts', 7)];
      board.tableau[0] = [placed('spades', 8)];
      board.tableau[2] = [placed('clubs', 8)];
      const move = findAutomaticMove(board, 1, { pile: 'waste' });
      assert(move.to.pile === 'tableau' && move.to.index === 0, 'Expected the leftmost legal tableau.');
      board.waste = [placed('hearts', 5)];
      assert(findAutomaticMove(board, 1, { pile: 'waste' }) === null, 'Expected no automatic move.');
    }
  },
  {
    name: 'Keeps card labels visible in tableau, dragged stacks, and waste fans',
    run() {
      const board = emptyBoard();
      board.tableau[0] = [placed('hearts', 7), placed('clubs', 6)];
      board.waste = [placed('clubs', 10), placed('diamonds', 4), placed('hearts', 5)];
      const view = createKlondikeBoard(board, {
        draw: 3, disabled: false, onDraw() {}, onMove() {}, onAutomaticMove() {}
      });
      document.body.append(view.element);
      const drag = document.createElement('div');
      drag.className = 'klondike-drag';
      const tableau = [...view.element.querySelectorAll('.klondike-column:first-child .klondike-card')];
      tableau.forEach(card => drag.append(card.cloneNode(true)));
      document.body.append(drag);
      try {
        for (const [cards, axis] of [
          [tableau, 'vertical'],
          [[...drag.children], 'vertical'],
          [[...view.element.querySelectorAll('.klondike-waste .klondike-card')], 'horizontal']
        ]) {
          cards.forEach((card, index) => {
            const box = card.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(card);
            const text = range.getBoundingClientRect();
            assert(text.top - box.top < 10 && text.left - box.left < 10,
              'A card label is not aligned at the upper-left.');
            const next = cards[index + 1]?.getBoundingClientRect();
            if (next) {
              const clearance = axis === 'vertical' ? next.top - text.bottom : next.left - text.right;
              assert(clearance >= 3,
                'A card label is obscured by the next card.');
            }
          });
        }
      } finally {
        view.cleanup();
        view.element.remove();
        drag.remove();
      }
    }
  },
  {
    name: 'Hides the dragged stack without changing layout and restores it on cancellation',
    run() {
      const board = emptyBoard();
      board.tableau[0] = [placed('hearts', 7), placed('clubs', 6)];
      const view = createKlondikeBoard(board, {
        draw: 1, disabled: false, onDraw() {}, onMove() {}, onAutomaticMove() {}
      });
      document.body.append(view.element);
      const cards = [...view.element.querySelectorAll('.klondike-column:first-child .klondike-card')];
      const initialTop = cards[1].getBoundingClientRect().top;
      cards[0].setPointerCapture = () => {};
      const pointer = (type, x) => cards[0].dispatchEvent(new PointerEvent(type, {
        bubbles: true, isPrimary: true, pointerId: 1, pointerType: 'mouse',
        button: 0, clientX: x, clientY: 100
      }));
      try {
        for (const cancel of [() => pointer('pointercancel', 110), () => view.cleanup()]) {
          pointer('pointerdown', 100);
          pointer('pointermove', 110);
          assert(cards.every(card => getComputedStyle(card).visibility === 'hidden'),
            'The original dragged stack remained visible.');
          assert(cards[1].getBoundingClientRect().top === initialTop,
            'Hiding the stack changed its layout.');
          assert(document.querySelectorAll('.klondike-drag .klondike-card').length === 2,
            'The dragged stack was not displayed.');
          cancel();
          assert(cards.every(card => getComputedStyle(card).visibility === 'visible') &&
            !document.querySelector('.klondike-drag'), 'Cancellation did not restore the original stack.');
        }
      } finally {
        view.cleanup();
        view.element.remove();
      }
    }
  },
  {
    name: 'Adds foundation and reveal scores and detects a completed game',
    run() {
      const board = emptyBoard();
      board.tableau[0] = [placed('clubs', 4, false), placed('hearts', 1)];
      const reveal = applyKlondikeAction(board, 1, {
        type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 },
        to: { pile: 'foundation', index: 0 }
      });
      assert(reveal.scoreDelta === 2, 'Foundation and reveal scores must add.');
      board.foundations = suits.map(suit =>
        Array.from({ length: 13 }, (_, index) => placed(suit, index + 1)));
      board.waste = [board.foundations[3].pop()];
      const win = applyKlondikeAction(board, 1, {
        type: 'move', from: { pile: 'waste' }, to: { pile: 'foundation', index: 3 }
      });
      assert(win.won, 'Completing the fourth foundation must win.');
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

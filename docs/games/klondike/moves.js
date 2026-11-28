/** @module Pure Klondike moves */

const ACE = 1;
const KING = 13;

/**
 * @typedef {{ pile: 'waste' | 'tableau' | 'foundation', index?: number, cardIndex?: number }} MoveSource
 * @typedef {{ pile: 'tableau' | 'foundation', index: number }} MoveDestination
 * @typedef {{ type: 'draw' } | { type: 'move', from: MoveSource, to: MoveDestination }} KlondikeAction
 */

export class IllegalMoveError extends Error {
  constructor() {
    super('That Klondike action is not legal.');
    this.name = 'IllegalMoveError';
  }
}

function isRed(card) {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

function followsTableau(card, below) {
  return below.faceUp && card.rank === below.card.rank - 1 &&
    isRed(card) !== isRed(below.card);
}

function indexedPile(piles, index) {
  if (!Number.isInteger(index) || index < 0 || index >= piles.length) {
    throw new IllegalMoveError();
  }
  return piles[index];
}

function drawCards(board, draw) {
  if (draw !== 1 && draw !== 3) throw new TypeError('Invalid Klondike draw option.');
  if (board.stock.length) {
    for (let count = 0; count < draw && board.stock.length; count += 1) {
      const placed = board.stock.pop();
      board.waste.push({ ...placed, faceUp: true });
    }
  } else if (board.waste.length) {
    while (board.waste.length) {
      const placed = board.waste.pop();
      board.stock.push({ ...placed, faceUp: false });
    }
  } else {
    throw new IllegalMoveError();
  }
  return 0;
}

function moveCards(board, from, to) {
  if (!from || !to) throw new IllegalMoveError();
  let source;
  if (from.pile === 'waste') source = board.waste;
  else if (from.pile === 'tableau') source = indexedPile(board.tableau, from.index);
  else if (from.pile === 'foundation') source = indexedPile(board.foundations, from.index);
  else throw new IllegalMoveError();

  const cardIndex = from.pile === 'tableau' ? from.cardIndex : source.length - 1;
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= source.length ||
      !source[cardIndex].faceUp) throw new IllegalMoveError();
  const moving = source.slice(cardIndex);
  if (moving.some((placed, index) =>
    !placed.faceUp || (index > 0 && !followsTableau(placed.card, moving[index - 1])))) {
    throw new IllegalMoveError();
  }

  let destination;
  if (to.pile === 'tableau') destination = indexedPile(board.tableau, to.index);
  else if (to.pile === 'foundation') destination = indexedPile(board.foundations, to.index);
  else throw new IllegalMoveError();
  if (source === destination) throw new IllegalMoveError();
  const top = destination[destination.length - 1];
  const card = moving[0].card;
  if (to.pile === 'tableau') {
    if (top ? !followsTableau(card, top) : card.rank !== KING) throw new IllegalMoveError();
  } else if (moving.length !== 1 || from.pile === 'foundation' ||
      (top ? top.card.suit !== card.suit || card.rank !== top.card.rank + 1 : card.rank !== ACE)) {
    throw new IllegalMoveError();
  }

  source.splice(cardIndex);
  destination.push(...moving);
  let scoreDelta = to.pile === 'foundation' || from.pile === 'waste' ? 1 : 0;
  if (from.pile === 'foundation') scoreDelta = -1;
  const exposed = source[source.length - 1];
  if (from.pile === 'tableau' && exposed && !exposed.faceUp) {
    source[source.length - 1] = { ...exposed, faceUp: true };
    scoreDelta += 1;
  }
  return scoreDelta;
}

/**
 * Apply one legal action without modifying the input board.
 * @param {import('./deal.js?v=2026-11-28-00-39').KlondikeBoard} board
 * @param {number} draw
 * @param {KlondikeAction} action
 * @returns {{ board: import('./deal.js?v=2026-11-28-00-39').KlondikeBoard, scoreDelta: number, won: boolean }}
 */
export function applyKlondikeAction(board, draw, action) {
  if (!action || (action.type !== 'draw' && action.type !== 'move')) {
    throw new IllegalMoveError();
  }
  const next = {
    stock: [...board.stock], waste: [...board.waste],
    tableau: board.tableau.map(pile => [...pile]),
    foundations: board.foundations.map(pile => [...pile])
  };
  const scoreDelta = action.type === 'draw'
    ? drawCards(next, draw)
    : moveCards(next, action.from, action.to);
  return {
    board: next, scoreDelta,
    won: next.foundations.length === 4 && next.foundations.every(pile => pile.length === KING)
  };
}

/**
 * Find the first legal foundation, then the leftmost legal tableau destination.
 * @param {import('./deal.js?v=2026-11-28-00-39').KlondikeBoard} board
 * @param {number} draw
 * @param {MoveSource} from
 * @returns {KlondikeAction | null}
 */
export function findAutomaticMove(board, draw, from) {
  for (const [pile, piles] of [['foundation', board.foundations], ['tableau', board.tableau]]) {
    for (let index = 0; index < piles.length; index += 1) {
      const action = { type: 'move', from, to: { pile, index } };
      try {
        applyKlondikeAction(board, draw, action);
        return action;
      } catch (error) {
        if (!(error instanceof IllegalMoveError)) throw error;
      }
    }
  }
  return null;
}

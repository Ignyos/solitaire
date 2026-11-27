/** @module Klondike's non-playable saved-board view */

const SUIT_SYMBOLS = {
  clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660'
};
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

function cardElement(placed) {
  const element = document.createElement('div');
  element.className = 'klondike-card';
  if (!placed.faceUp) {
    element.classList.add('klondike-card-back');
    return element;
  }
  const { suit, rank } = placed.card;
  if (suit === 'hearts' || suit === 'diamonds') element.classList.add('klondike-card-red');
  element.textContent = `${RANK_LABELS[rank] ?? rank}${SUIT_SYMBOLS[suit]}`;
  return element;
}

/**
 * @param {import('./deal.js?v=2026-10-21-23-35').KlondikeBoard|null} board
 * @returns {{ element: HTMLElement, scrollArea: HTMLElement, hint: HTMLElement }}
 */
export function createKlondikeBoard(board) {
  const element = document.createElement('section');
  element.className = 'klondike-board-section';
  element.setAttribute('aria-label', 'Saved Klondike board');
  const hint = document.createElement('p');
  hint.className = 'klondike-scroll-hint';
  hint.textContent = 'Scroll to see the rest of the board.';
  hint.hidden = true;
  const scrollArea = document.createElement('div');
  scrollArea.className = 'klondike-scroll-area';
  const surface = document.createElement('div');
  surface.className = 'klondike-board';
  surface.setAttribute('aria-hidden', 'true');
  const top = document.createElement('div');
  top.className = 'klondike-board-top';
  const foundations = document.createElement('div');
  foundations.className = 'klondike-foundations';
  for (const pile of board?.foundations ?? [[], [], [], []]) {
    const spot = document.createElement('div');
    spot.className = 'klondike-pile';
    if (pile.length) spot.append(cardElement(pile[pile.length - 1]));
    foundations.append(spot);
  }
  const stockArea = document.createElement('div');
  stockArea.className = 'klondike-stock-area';
  const waste = document.createElement('div');
  waste.className = 'klondike-pile';
  if (board?.waste.length) waste.append(cardElement(board.waste[board.waste.length - 1]));
  const stock = document.createElement('div');
  stock.className = 'klondike-pile';
  if (board?.stock.length) stock.append(cardElement(board.stock[board.stock.length - 1]));
  stockArea.append(waste, stock);
  top.append(foundations, stockArea);

  const tableau = document.createElement('div');
  tableau.className = 'klondike-tableau';
  for (const column of board?.tableau ?? [[], [], [], [], [], [], []]) {
    const pile = document.createElement('div');
    pile.className = 'klondike-column';
    for (const card of column) pile.append(cardElement(card));
    tableau.append(pile);
  }
  surface.append(top, tableau);
  scrollArea.append(surface);
  element.append(hint, scrollArea);
  return { element, scrollArea, hint };
}

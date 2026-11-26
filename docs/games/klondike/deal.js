/** @module Klondike deal setup */

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS_PER_SUIT = 13;
const DECK_SIZE = SUITS.length * RANKS_PER_SUIT;
const TABLEAU_COLUMNS = 7;
const FOUNDATION_COUNT = 4;

/**
 * @typedef {{ suit: 'clubs' | 'diamonds' | 'hearts' | 'spades', rank: number }} Card
 * @typedef {{ card: Card, faceUp: boolean }} PlacedCard
 * @typedef {{ tableau: PlacedCard[][], stock: PlacedCard[], waste: PlacedCard[], foundations: PlacedCard[][] }} KlondikeBoard
 */

/**
 * Build a starting board from a shuffled deck. The last stock entry is its top.
 * @param {Card[]} cardOrder - Cards in the order they are dealt.
 * @returns {KlondikeBoard}
 */
export function dealKlondike(cardOrder) {
  if (!Array.isArray(cardOrder) || cardOrder.length !== DECK_SIZE) {
    throw new TypeError('A Klondike deal requires 52 cards.');
  }

  const identities = new Set();
  for (const card of cardOrder) {
    if (!card || !SUITS.includes(card.suit) ||
        !Number.isInteger(card.rank) || card.rank < 1 || card.rank > RANKS_PER_SUIT) {
      throw new TypeError('A Klondike deck must contain valid suits and ranks.');
    }
    identities.add(`${card.suit}:${card.rank}`);
  }
  if (identities.size !== DECK_SIZE) {
    throw new TypeError('A Klondike deck must contain each card exactly once.');
  }

  const tableau = Array.from({ length: TABLEAU_COLUMNS }, () => []);
  let nextCard = 0;
  for (let row = 0; row < TABLEAU_COLUMNS; row += 1) {
    for (let column = row; column < TABLEAU_COLUMNS; column += 1) {
      const { suit, rank } = cardOrder[nextCard];
      tableau[column].push({ card: { suit, rank }, faceUp: row === column });
      nextCard += 1;
    }
  }

  const stock = cardOrder.slice(nextCard).reverse()
    .map(({ suit, rank }) => ({ card: { suit, rank }, faceUp: false }));
  return {
    tableau,
    stock,
    waste: [],
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => [])
  };
}

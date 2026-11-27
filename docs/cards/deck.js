/** @module Standard deck generation and deal fingerprints */

/** @typedef {{ suit: 'clubs' | 'diamonds' | 'hearts' | 'spades', rank: number }} Card */

/** @type {Card['suit'][]} */
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS_PER_SUIT = 13;
const UINT32_RANGE = 2 ** 32;

/**
 * Generate a uniformly shuffled standard deck using browser cryptography.
 * @returns {Card[]}
 */
export function shuffledDeck() {
  const cards = SUITS.flatMap(suit =>
    Array.from({ length: RANKS_PER_SUIT }, (_, index) => ({ suit, rank: index + 1 })));
  const random = new Uint32Array(1);
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const bound = index + 1;
    const limit = UINT32_RANGE - (UINT32_RANGE % bound);
    do {
      crypto.getRandomValues(random);
    } while (random[0] >= limit);
    const selected = random[0] % bound;
    [cards[index], cards[selected]] = [cards[selected], cards[index]];
  }
  return cards;
}

/**
 * @param {Card[]} cards
 * @param {number} dealingVersion
 * @returns {Promise<string>}
 */
export async function fingerprintDeal(cards, dealingVersion) {
  const canonical = JSON.stringify([dealingVersion, cards.map(({ suit, rank }) => [suit, rank])]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

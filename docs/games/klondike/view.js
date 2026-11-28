/** @module Klondike saved-board view */

const SUIT_SYMBOLS = {
  clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660'
};
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const DRAG_THRESHOLD = 6;
const SCROLL_EDGE = 28;
const SCROLL_STEP = 8;

function cardElement(placed, source, disabled) {
  const element = document.createElement(source ? 'button' : 'div');
  element.className = 'klondike-card';
  if (!placed.faceUp) {
    element.classList.add('klondike-card-back');
    return element;
  }
  const { suit, rank } = placed.card;
  if (suit === 'hearts' || suit === 'diamonds') element.classList.add('klondike-card-red');
  element.textContent = `${RANK_LABELS[rank] ?? rank}${SUIT_SYMBOLS[suit]}`;
  if (source) {
    element.type = 'button';
    element.disabled = disabled;
    element.dataset.source = JSON.stringify(source);
    element.setAttribute('aria-label', `${RANK_LABELS[rank] ?? rank} of ${suit}, ${source.pile}`);
    element.setAttribute('aria-pressed', 'false');
  }
  return element;
}

function emptyDestination(label, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'klondike-empty';
  button.disabled = disabled;
  button.setAttribute('aria-label', label);
  return button;
}

function enableCardInteraction(surface, scrollArea, onMove, onAutomaticMove) {
  let selected = null;
  let drag = null;

  function clearSelection() {
    if (selected) selected.element.setAttribute('aria-pressed', 'false');
    selected = null;
  }

  function startAutoScroll() {
    if (!drag?.ghost) return;
    const bounds = scrollArea.getBoundingClientRect();
    const left = Math.max(bounds.left, 0);
    const right = Math.min(bounds.right, window.innerWidth);
    if (drag.x < left + SCROLL_EDGE) scrollArea.scrollLeft -= SCROLL_STEP;
    else if (drag.x > right - SCROLL_EDGE) scrollArea.scrollLeft += SCROLL_STEP;
    if (drag.y < SCROLL_EDGE) window.scrollBy(0, -SCROLL_STEP);
    else if (drag.y > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, SCROLL_STEP);
    drag.frame = requestAnimationFrame(startAutoScroll);
  }

  function endDrag() {
    if (drag?.frame) cancelAnimationFrame(drag.frame);
    drag?.ghost?.remove();
    drag?.hiddenCards.forEach(card => card.classList.remove('klondike-card-dragging'));
    drag = null;
  }

  surface.addEventListener('pointerdown', event => {
    const card = event.target.closest('[data-source]');
    if (!card || card.disabled || !event.isPrimary || event.button !== 0) return;
    clearSelection();
    const bounds = card.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId, card, source: JSON.parse(card.dataset.source),
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top,
      ghost: null, frame: null, hiddenCards: []
    };
    card.setPointerCapture(event.pointerId);
  });

  surface.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.ghost && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= DRAG_THRESHOLD) {
      const ghost = document.createElement('div');
      ghost.className = 'klondike-drag';
      ghost.setAttribute('aria-hidden', 'true');
      let card = drag.card;
      while (card) {
        const copy = card.cloneNode(true);
        copy.tabIndex = -1;
        ghost.append(copy);
        drag.hiddenCards.push(card);
        card = drag.source.pile === 'tableau' ? card.nextElementSibling : null;
      }
      document.body.append(ghost);
      drag.ghost = ghost;
      drag.hiddenCards.forEach(hiddenCard => hiddenCard.classList.add('klondike-card-dragging'));
      startAutoScroll();
    }
    if (drag.ghost) {
      drag.ghost.style.left = `${drag.x - drag.offsetX}px`;
      drag.ghost.style.top = `${drag.y - drag.offsetY}px`;
    }
  });

  surface.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { source, ghost } = drag;
    const destination = ghost
      ? document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-destination]')
      : null;
    endDrag();
    if (ghost && destination && surface.contains(destination)) {
      onMove(source, JSON.parse(destination.dataset.destination));
    } else if (!ghost && event.pointerType === 'touch') {
      onAutomaticMove(source);
    }
  });
  surface.addEventListener('pointercancel', endDrag);
  surface.addEventListener('lostpointercapture', endDrag);
  surface.addEventListener('dblclick', event => {
    const card = event.target.closest('[data-source]');
    if (card && !card.disabled) onAutomaticMove(JSON.parse(card.dataset.source));
  });
  surface.addEventListener('click', event => {
    if (event.detail !== 0) return;
    const card = event.target.closest('[data-source]');
    const destination = event.target.closest('[data-destination]');
    if (selected && destination) {
      const from = selected.source;
      clearSelection();
      onMove(from, JSON.parse(destination.dataset.destination));
    } else if (card && !card.disabled) {
      clearSelection();
      selected = { element: card, source: JSON.parse(card.dataset.source) };
      card.setAttribute('aria-pressed', 'true');
    }
  });
  surface.addEventListener('keydown', event => {
    if (event.key === 'Escape') clearSelection();
  });
  return endDrag;
}

/**
 * @param {import('./deal.js?v=2026-11-28-00-39').KlondikeBoard|null} board
 * @param {{ draw: number, disabled: boolean, onDraw: () => void, onMove: (from: import('./moves.js?v=2026-11-28-00-39').MoveSource, to: import('./moves.js?v=2026-11-28-00-39').MoveDestination) => void, onAutomaticMove: (from: import('./moves.js?v=2026-11-28-00-39').MoveSource) => void }} options
 * @returns {{ element: HTMLElement, scrollArea: HTMLElement, hint: HTMLElement, cleanup: () => void }}
 */
export function createKlondikeBoard(board, { draw, disabled, onDraw, onMove, onAutomaticMove }) {
  const element = document.createElement('section');
  element.className = 'klondike-board-section';
  element.setAttribute('aria-label', 'Klondike board');
  const hint = document.createElement('p');
  hint.className = 'klondike-scroll-hint';
  hint.textContent = 'Scroll to see the rest of the board.';
  hint.hidden = true;
  const scrollArea = document.createElement('div');
  scrollArea.className = 'klondike-scroll-area';
  const surface = document.createElement('div');
  surface.className = 'klondike-board';
  const top = document.createElement('div');
  top.className = 'klondike-board-top';
  const foundations = document.createElement('div');
  foundations.className = 'klondike-foundations';
  for (const [index, pile] of (board?.foundations ?? [[], [], [], []]).entries()) {
    const spot = document.createElement('div');
    spot.className = 'klondike-pile';
    spot.dataset.destination = JSON.stringify({ pile: 'foundation', index });
    if (pile.length) spot.append(cardElement(pile[pile.length - 1], { pile: 'foundation', index }, disabled));
    else spot.append(emptyDestination(`Empty foundation ${index + 1}`, disabled));
    foundations.append(spot);
  }
  const stockArea = document.createElement('div');
  stockArea.className = 'klondike-stock-area';
  const waste = document.createElement('div');
  waste.className = 'klondike-pile klondike-waste';
  const visibleWaste = board?.waste.slice(-(draw === 3 ? 3 : 1)) ?? [];
  for (const [index, card] of visibleWaste.entries()) {
    const source = index === visibleWaste.length - 1 ? { pile: 'waste' } : null;
    waste.append(cardElement(card, source, disabled));
  }
  const stock = document.createElement('button');
  stock.type = 'button';
  stock.className = 'klondike-pile klondike-stock';
  stock.disabled = disabled || !board || (!board.stock.length && !board.waste.length);
  stock.setAttribute('aria-label', board?.stock.length ? 'Draw from stock' : 'Recycle waste into stock');
  stock.addEventListener('click', onDraw);
  if (board?.stock.length) stock.append(cardElement(board.stock[board.stock.length - 1]));
  stockArea.append(waste, stock);
  top.append(foundations, stockArea);

  const tableau = document.createElement('div');
  tableau.className = 'klondike-tableau';
  for (const [index, column] of (board?.tableau ?? [[], [], [], [], [], [], []]).entries()) {
    const pile = document.createElement('div');
    pile.className = 'klondike-column';
    pile.dataset.destination = JSON.stringify({ pile: 'tableau', index });
    if (!column.length) pile.append(emptyDestination(`Empty tableau ${index + 1}`, disabled));
    for (const [cardIndex, card] of column.entries()) {
      const source = card.faceUp ? { pile: 'tableau', index, cardIndex } : null;
      pile.append(cardElement(card, source, disabled));
    }
    tableau.append(pile);
  }
  surface.append(top, tableau);
  const cleanup = enableCardInteraction(surface, scrollArea, onMove, onAutomaticMove);
  scrollArea.append(surface);
  element.append(hint, scrollArea);
  return { element, scrollArea, hint, cleanup };
}

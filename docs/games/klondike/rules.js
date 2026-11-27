/** @module Klondike rules content */

export const klondikeRules = {
  title: 'Klondike rules',
  introduction: 'These rules describe classic draw-one and draw-three Klondike.',
  sections: [
    {
      heading: 'Objective',
      paragraphs: [
        'Move all cards to the four foundations, building each suit from Ace through King.',
        'The game is won when all four foundations are complete.'
      ]
    },
    {
      heading: 'Deal',
      paragraphs: [
        'Deal seven tableau columns. The first column contains one card, the second contains two, and so on through the seventh column.',
        'Only the top card of each column starts face up. Remaining cards form the stock.'
      ]
    },
    {
      heading: 'Tableau moves',
      paragraphs: [
        'Build tableau columns downward in alternating colors. For example, a red 7 may be placed on a black 8.',
        'Move a face-up card, or a correctly ordered sequence beginning with that card, between tableau columns.',
        'A King or a sequence headed by a King may fill an empty tableau column.'
      ]
    },
    {
      heading: 'Stock and waste',
      paragraphs: [
        'Draw cards from the stock to the waste. In draw-one play, turn one card at a time; in draw-three play, turn three.',
        'In draw-three play, only the top waste card is available. Recycle the waste back to the stock when no cards remain.',
        'The waste may be turned through repeatedly unless the selected variant says otherwise.'
      ]
    },
    {
      heading: 'Foundations',
      paragraphs: [
        'Place Aces on empty foundation piles, then build upward in the same suit to King.',
        'Only cards that are available for play may be moved to a foundation.'
      ]
    },
    {
      heading: 'Controls and scoring',
      paragraphs: [
        'Drag cards to a destination. Double-click a card, or tap it on a phone, to move it automatically: foundations are preferred, then the leftmost legal tableau.',
        'With a keyboard, select a face-up card and then a destination; press Escape to cancel the selection.',
        'Undo reverses the last action, including any card it revealed, and costs one point. Undo remains available after resuming an unfinished deal.',
        'Moving a card to a foundation, revealing a tableau card, or moving a waste card to the tableau earns one point each. Moving a foundation card back to the tableau costs one point.'
      ]
    }
  ]
};

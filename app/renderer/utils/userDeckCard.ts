interface UserDeckCardData {
  id: string;
  name: string;
  locale?: string;
  cardCount: number;
}

interface UserDeckCardOptions {
  themeLabel: string;
  localeLabel: string;
  description: string;
  onSelect: (event: MouseEvent) => void;
  onDelete: () => void;
}

function appendTextElement(
  parent: HTMLElement,
  tagName: 'div' | 'h3' | 'p' | 'span' | 'button',
  className: string,
  text: string,
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

export function createUserDeckCard(
  deck: UserDeckCardData,
  options: UserDeckCardOptions,
): HTMLDivElement {
  const deckCard = document.createElement('div');
  deckCard.className = 'deck-card user-deck';
  deckCard.dataset.deck = deck.id;
  deckCard.dataset.isUserDeck = 'true';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-deck-btn';
  deleteButton.type = 'button';
  deleteButton.title = 'Delete deck';
  deleteButton.dataset.deckId = deck.id;
  deleteButton.textContent = '✕';
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onDelete();
  });
  deckCard.appendChild(deleteButton);

  appendTextElement(deckCard, 'div', 'deck-theme', options.themeLabel);
  appendTextElement(deckCard, 'h3', 'deck-title', deck.name);
  appendTextElement(deckCard, 'p', 'deck-description', options.description);

  const stats = document.createElement('div');
  stats.className = 'deck-stats';
  appendTextElement(stats, 'span', '', `${deck.cardCount} Cards`);
  appendTextElement(stats, 'span', '', options.localeLabel);
  deckCard.appendChild(stats);

  deckCard.addEventListener('click', (event) => {
    const { target } = event;
    if (target instanceof Element && target.classList.contains('delete-deck-btn')) {
      return;
    }

    options.onSelect(event);
  });

  return deckCard;
}

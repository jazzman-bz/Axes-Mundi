import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createUserDeckCard } from '@/utils/userDeckCard';

describe('userDeckCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders user-supplied deck fields as text instead of HTML', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const deckCard = createUserDeckCard({
      id: 'unsafe-deck',
      name: '<img src=x onerror=alert(1)>',
      cardCount: 12,
      locale: 'en',
    }, {
      themeLabel: 'Science & Mass',
      localeLabel: 'English',
      description: '<script>alert("xss")</script>',
      onSelect,
      onDelete,
    });

    document.body.appendChild(deckCard);

    expect(deckCard.querySelector('.deck-title')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(deckCard.querySelector('.deck-description')?.textContent).toBe('<script>alert("xss")</script>');
    expect(deckCard.querySelector('.deck-title img')).toBeNull();
    expect(deckCard.querySelector('.deck-description script')).toBeNull();
  });

  it('routes deck and delete clicks to separate handlers', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const deckCard = createUserDeckCard({
      id: 'biology-mass-en',
      name: 'Biology - Mass',
      cardCount: 83,
      locale: 'en',
    }, {
      themeLabel: 'Science & Mass',
      localeLabel: 'English',
      description: 'Compare living things by mass.',
      onSelect,
      onDelete,
    });

    document.body.appendChild(deckCard);

    deckCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    const deleteButton = deckCard.querySelector('.delete-deck-btn');
    expect(deleteButton).not.toBeNull();
    deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

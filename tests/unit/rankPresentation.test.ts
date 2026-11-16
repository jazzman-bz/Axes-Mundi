import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createMatchRankSummary, createRankProfile } from '@/utils/rankPresentation';

describe('rank presentation', () => {
  const promotion = {
    name: 'Joe', avatar: '1', previousTotalScore: 970, totalScore: 1045,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the persisted rank with an avatar badge and progress for an existing profile', () => {
    const { element } = createRankProfile('Joe', '1', 1045);
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Gold, level 3 avatar');
    expect(element.querySelector('.rank-level')?.textContent).toBe('3');
    expect(element.textContent).toContain('955 points to Platinum');
  });

  it('fills the previous rank before revealing the new frame and remaining points', () => {
    const summary = createMatchRankSummary(promotion);
    document.body.append(summary);

    expect(summary.querySelector('.rank-label')?.textContent).toBe('Silver · Level 2');
    vi.advanceTimersByTime(60);
    expect(summary.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(summary.querySelector('.rank-avatar')?.getAttribute('data-rank')).toBe('silver');
    vi.advanceTimersByTime(400);

    expect(summary.querySelector('.rank-avatar')?.getAttribute('data-rank')).toBe('gold');
    expect(summary.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('5');
    expect(summary.querySelector('[role="status"]')?.textContent).toBe('Rank up! Gold · +75 profile points');
  });

  it('credits progress within a rank without a promotion', () => {
    const summary = createMatchRankSummary({ ...promotion, totalScore: 995 });
    document.body.append(summary);
    vi.runAllTimers();

    expect(summary.classList.contains('rank-promoted')).toBe(false);
    expect(summary.querySelector('[role="status"]')?.textContent).toBe('+25 profile points');
    expect(summary.querySelector('.rank-next')?.textContent).toBe('5 points to Gold');
  });

  it('shows the completed promotion immediately with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const summary = createMatchRankSummary(promotion);
    expect(summary.querySelector('.rank-label')?.textContent).toBe('Gold · Level 3');
    expect(vi.getTimerCount()).toBe(0);
  });
});

import { getRankProgress, PlayerRank } from '@/data/playerRanks';

const AVATARS: Record<string, string> = {
  1: '👨‍🚀', 2: '🧙‍♂️', 3: '🏴‍☠️', 4: '🦄', 5: '🤖', 6: '🐉',
};

const points = new Intl.NumberFormat('en');

export interface MatchRankUpdate {
  name: string;
  avatar: string | null;
  previousTotalScore: number;
  totalScore: number;
}

export function createRankAvatar(avatarId: string | null, rank?: PlayerRank): HTMLSpanElement {
  const avatar = document.createElement('span');
  avatar.className = 'rank-avatar';
  avatar.textContent = (avatarId && AVATARS[avatarId]) || '👤';
  if (rank) {
    avatar.dataset.rank = rank.id;
    avatar.setAttribute('role', 'img');
    avatar.setAttribute('aria-label', `${rank.label}, level ${rank.level} avatar`);
    const level = document.createElement('span');
    level.className = 'rank-level';
    level.setAttribute('aria-hidden', 'true');
    level.textContent = String(rank.level);
    avatar.append(level);
  }
  return avatar;
}

export function createRankProfile(name: string, avatarId: string | null, totalScore: number) {
  const element = document.createElement('span');
  element.className = 'rank-profile';
  const avatarSlot = document.createElement('span');
  const details = document.createElement('span');
  details.className = 'rank-details';

  const playerName = document.createElement('strong');
  playerName.className = 'rank-player-name';
  playerName.textContent = name;

  const rankLabel = document.createElement('span');
  rankLabel.className = 'rank-label';
  const total = document.createElement('span');
  total.className = 'rank-total';
  const progress = document.createElement('span');
  progress.className = 'rank-progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', `${name}'s rank progress`);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('span');
  fill.className = 'rank-progress-fill';
  progress.append(fill);
  const next = document.createElement('span');
  next.className = 'rank-next';
  details.append(playerName, rankLabel, total, progress, next);
  element.append(avatarSlot, details);

  const setProgress = (percent: number, description: string) => {
    fill.style.width = `${percent}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(percent)));
    progress.setAttribute('aria-valuetext', description);
  };

  const render = (score: number) => {
    const state = getRankProgress(score);
    element.dataset.rank = state.rank.id;
    avatarSlot.replaceChildren(createRankAvatar(avatarId, state.rank));
    rankLabel.textContent = `${state.rank.label} · Level ${state.rank.level}`;
    total.textContent = `${points.format(score)} points`;
    next.textContent = state.nextRank
      ? `${points.format(state.pointsRemaining)} points to ${state.nextRank.label}`
      : 'Highest rank reached';
    setProgress(state.percent, next.textContent);
  };

  render(totalScore);
  return { element, render, setProgress };
}

export function createMatchRankSummary(update: MatchRankUpdate): HTMLElement {
  const {
    name, avatar, previousTotalScore, totalScore,
  } = update;
  const previousRank = getRankProgress(previousTotalScore).rank;
  const nextRank = getRankProgress(totalScore).rank;
  const rankUp = previousRank.level < nextRank.level;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const profile = createRankProfile(name, avatar, reduceMotion ? totalScore : previousTotalScore);
  const section = document.createElement('div');
  section.className = 'match-rank-summary';
  const status = document.createElement('p');
  status.className = 'match-rank-status';
  status.setAttribute('role', 'status');
  section.append(profile.element, status);

  const finish = () => {
    if (rankUp) {
      profile.element.classList.remove('rank-moving');
      section.classList.add('rank-promoted');
    }
    profile.render(totalScore);
    const earned = `+${points.format(totalScore - previousTotalScore)} profile points`;
    status.textContent = rankUp ? `Rank up! ${nextRank.label} · ${earned}` : earned;
  };

  if (reduceMotion || totalScore === previousTotalScore) {
    finish();
  } else {
    profile.element.classList.add('rank-moving');
    window.setTimeout(() => {
      if (!section.isConnected) return;
      if (rankUp) {
        profile.setProgress(100, `${previousRank.label} completed`);
        window.setTimeout(() => {
          if (section.isConnected) finish();
        }, 400);
      } else {
        finish();
      }
    }, 60);
  }

  return section;
}

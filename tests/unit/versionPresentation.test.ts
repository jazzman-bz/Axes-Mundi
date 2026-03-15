import { describe, expect, it } from 'vitest';
import { formatVersionBadge, formatVersionTooltip } from '../../app/renderer/utils/versionPresentation';

describe('versionPresentation', () => {
  it('formats the version badge with commit hash', () => {
    expect(formatVersionBadge({
      appVersion: '1.2.3',
      commit: 'abc1234',
      dirty: false,
    })).toBe('v1.2.3 (abc1234)');
  });

  it('marks dirty builds in the version badge', () => {
    expect(formatVersionBadge({
      appVersion: '1.2.3',
      commit: 'abc1234',
      dirty: true,
    })).toBe('v1.2.3 (abc1234, dirty)');
  });

  it('falls back when commit metadata is missing', () => {
    expect(formatVersionBadge({
      appVersion: '1.2.3',
      commit: 'unknown',
    })).toBe('v1.2.3 (no-commit)');
  });

  it('includes branch and build date in the tooltip', () => {
    expect(formatVersionTooltip({
      appVersion: '1.2.3',
      commit: 'abc1234',
      branch: 'main',
      buildDate: '2026-03-15T14:30:00.000Z',
      dirty: false,
    })).toBe('Version 1.2.3 | Commit abc1234 | Branch main | Built 2026-03-15T14:30:00.000Z');
  });

  it('mentions dirty state in the tooltip', () => {
    expect(formatVersionTooltip({
      appVersion: '1.2.3',
      commit: 'abc1234',
      dirty: true,
    })).toBe('Version 1.2.3 | Commit abc1234 | Uncommitted changes included');
  });
});

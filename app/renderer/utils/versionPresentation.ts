export interface AppVersionInfo {
  appVersion: string;
  commit: string;
  branch?: string;
  dirty?: boolean;
  buildDate?: string;
}

export function formatVersionBadge(info: AppVersionInfo | null | undefined): string {
  if (!info) {
    return 'vunknown';
  }

  const commitPart = info.commit && info.commit !== 'unknown'
    ? info.commit
    : 'no-commit';
  const dirtySuffix = info.dirty ? ', dirty' : '';

  return `v${info.appVersion} (${commitPart}${dirtySuffix})`;
}

export function formatVersionTooltip(info: AppVersionInfo | null | undefined): string {
  if (!info) {
    return 'Version information unavailable';
  }

  const parts = [
    `Version ${info.appVersion}`,
    `Commit ${info.commit || 'unknown'}`,
  ];

  if (info.branch && info.branch !== 'unknown') {
    parts.push(`Branch ${info.branch}`);
  }

  if (info.buildDate) {
    parts.push(`Built ${info.buildDate}`);
  }

  if (info.dirty) {
    parts.push('Uncommitted changes included');
  }

  return parts.join(' | ');
}

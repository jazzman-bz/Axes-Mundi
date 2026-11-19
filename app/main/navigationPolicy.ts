import { resolve, sep } from 'path';
import { fileURLToPath } from 'url';

/**
 * Where the app's own pages are served from. Only one of the two is set:
 * the Vite dev server in development, the packaged renderer folder in production.
 */
export interface AppUrlPolicy {
  /** Dev server address, e.g. http://localhost:5179. Any path on this origin is allowed. */
  devServerUrl?: string;
  /** Absolute folder that holds the packaged renderer HTML pages. */
  rendererDir?: string;
}

/**
 * Returns true when `url` is one of the app's own pages and may be loaded in the window.
 * Everything else (remote sites, other local files, data:, javascript:) is refused.
 */
export function isAllowedAppUrl(url: string, policy: AppUrlPolicy): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (policy.devServerUrl && parsed.origin === new URL(policy.devServerUrl).origin) {
    return true;
  }

  if (policy.rendererDir && parsed.protocol === 'file:') {
    const rendererRoot = resolve(policy.rendererDir);
    const targetPath = resolve(fileURLToPath(parsed));
    return targetPath.startsWith(`${rendererRoot}${sep}`) && targetPath.toLowerCase().endsWith('.html');
  }

  return false;
}

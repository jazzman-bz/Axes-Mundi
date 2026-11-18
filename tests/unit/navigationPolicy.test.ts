import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import { isAllowedAppUrl } from '../../app/main/navigationPolicy';

const rendererDir = resolve('/opt/axes-mundi/dist/renderer');
const fileUrl = (path: string) => pathToFileURL(path).href;

describe('isAllowedAppUrl', () => {
  describe('packaged app', () => {
    const policy = { rendererDir };

    it('allows the app pages, including hash routes', () => {
      expect(isAllowedAppUrl(fileUrl(join(rendererDir, 'index.html')), policy)).toBe(true);
      expect(isAllowedAppUrl(fileUrl(join(rendererDir, 'game.html')), policy)).toBe(true);
      expect(isAllowedAppUrl(`${fileUrl(join(rendererDir, 'index.html'))}#account-selection`, policy)).toBe(true);
    });

    it('refuses other local files and paths that climb out of the renderer folder', () => {
      expect(isAllowedAppUrl(fileUrl('/etc/passwd'), policy)).toBe(false);
      expect(isAllowedAppUrl(fileUrl(join(rendererDir, '..', 'main', 'index.html')), policy)).toBe(false);
      expect(isAllowedAppUrl(`file://${rendererDir}/../outside.html`, policy)).toBe(false);
      expect(isAllowedAppUrl(fileUrl(join(rendererDir, 'decks', 'deck.json')), policy)).toBe(false);
    });

    it('refuses remote sites and script URLs', () => {
      expect(isAllowedAppUrl('https://example.com/', policy)).toBe(false);
      expect(isAllowedAppUrl('http://localhost:5179/game.html', policy)).toBe(false);
      expect(isAllowedAppUrl(['javascript', 'alert(1)'].join(':'), policy)).toBe(false);
      expect(isAllowedAppUrl('data:text/html,<p>x</p>', policy)).toBe(false);
      expect(isAllowedAppUrl('not a url', policy)).toBe(false);
    });
  });

  describe('development', () => {
    const policy = { devServerUrl: 'http://localhost:5179' };

    it('allows any page on the dev server', () => {
      expect(isAllowedAppUrl('http://localhost:5179/game.html', policy)).toBe(true);
      expect(isAllowedAppUrl('http://localhost:5179/index.html#account-selection', policy)).toBe(true);
    });

    it('refuses other ports, hosts and local files', () => {
      expect(isAllowedAppUrl('http://localhost:8080/', policy)).toBe(false);
      expect(isAllowedAppUrl('http://localhost.evil.example:5179/', policy)).toBe(false);
      expect(isAllowedAppUrl(fileUrl(join(rendererDir, 'index.html')), policy)).toBe(false);
    });
  });
});

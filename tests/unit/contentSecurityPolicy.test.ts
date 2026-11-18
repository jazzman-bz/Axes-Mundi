import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '../..');
const viteConfig = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf-8');
// Every page Vite builds into the app, e.g. resolve(__dirname, 'app/renderer/index.html')
const pages = [...viteConfig.matchAll(/'(app\/renderer\/[\w-]+\.html)'/g)].map((match) => match[1]);

const SELF = '\'self\'';
const NONE = '\'none\'';

function getPolicy(html: string): Map<string, string[]> {
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  if (!meta) return new Map();
  return new Map(meta[1].split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map(([name, ...sources]) => [name, sources]));
}

describe('Content-Security-Policy', () => {
  it('finds the pages Vite builds', () => {
    expect(pages).toEqual(expect.arrayContaining([
      'app/renderer/index.html', 'app/renderer/game.html', 'app/renderer/lan-game.html',
    ]));
  });

  it.each(pages)('%s only runs the app\'s own script files', (page) => {
    const html = readFileSync(join(repoRoot, page), 'utf-8');
    const policy = getPolicy(html);

    expect(policy.get('script-src')).toEqual([SELF]);
    expect(policy.get('object-src')).toEqual([NONE]);
    expect(policy.get('base-uri')).toEqual([NONE]);
    expect(policy.get('default-src')).toEqual([SELF]);
    expect(html).not.toContain('unsafe-eval');
    // Images from imported decks are served by the app's own protocol, never from the web.
    expect(policy.get('img-src')).not.toContain('https:');

    // Inline scripts and inline event handlers would be blocked by the policy.
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/\son[a-z]+="/);
  });
});

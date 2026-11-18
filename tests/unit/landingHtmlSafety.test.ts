import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const landingSource = readFileSync(join(__dirname, '../../app/renderer/landing.js'), 'utf-8');

describe('landing page HTML safety', () => {
  it('never assigns interpolated strings to innerHTML', () => {
    // Imported deck names reach these messages, so they must go through textContent.
    const unsafeAssignments = landingSource.match(/\.innerHTML\s*\+?=\s*`[^`]*\$\{[^`]*`/g) ?? [];
    expect(unsafeAssignments).toEqual([]);
  });

  it('builds the success toast and loading overlay from DOM nodes', () => {
    expect(landingSource).not.toMatch(/toast\.innerHTML/);
    expect(landingSource).not.toMatch(/overlay\.innerHTML/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeNextVersion,
  mergeSections,
  parseFragment,
  renderChangelogEntry,
} from '../scripts/compile-changelog.mjs';

describe('parseFragment', () => {
  it('parses category sections and bullets from a fragment', () => {
    const content = '**Backend**\n\n- Did a thing.\n- Did another thing.\n\n**Docs**\n\n- Updated the readme.\n';
    expect(parseFragment(content, 'test.md')).toEqual([
      { category: 'Backend', bullets: ['Did a thing.', 'Did another thing.'] },
      { category: 'Docs', bullets: ['Updated the readme.'] },
    ]);
  });

  it('rejects an unknown category name', () => {
    const content = '**Nonsense**\n\n- Whatever.\n';
    expect(() => parseFragment(content, 'bad.md')).toThrow(/Unknown changelog category/);
  });

  it('rejects a bullet that appears before any category heading', () => {
    const content = '- Orphan bullet.\n';
    expect(() => parseFragment(content, 'bad.md')).toThrow(/before any/);
  });
});

describe('mergeSections', () => {
  it('orders merged categories canonically regardless of fragment order', () => {
    const fragmentA = parseFragment('**Docs**\n\n- Doc bullet.\n', 'a.md');
    const fragmentB = parseFragment(
      '**Web App**\n\n- Web bullet.\n\n**Backend**\n\n- Backend bullet.\n',
      'b.md',
    );
    const merged = mergeSections([fragmentA, fragmentB]);
    expect(merged.map((section) => section.category)).toEqual(['Web App', 'Backend', 'Docs']);
  });

  it('merges bullets across fragments that share a category', () => {
    const fragmentA = parseFragment('**Backend**\n\n- First backend bullet.\n', 'a.md');
    const fragmentB = parseFragment('**Backend**\n\n- Second backend bullet.\n', 'b.md');
    const merged = mergeSections([fragmentA, fragmentB]);
    expect(merged).toEqual([
      { category: 'Backend', bullets: ['First backend bullet.', 'Second backend bullet.'] },
    ]);
  });

  it('omits categories no fragment touched', () => {
    const merged = mergeSections([parseFragment('**Docs**\n\n- Only docs.\n', 'a.md')]);
    expect(merged).toEqual([{ category: 'Docs', bullets: ['Only docs.'] }]);
  });

  it('errors clearly when there are no fragments to compile', () => {
    expect(() => mergeSections([])).toThrow(/No changelog fragments/);
  });
});

describe('computeNextVersion', () => {
  it('bumps patch', () => {
    expect(computeNextVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('bumps minor and resets patch', () => {
    expect(computeNextVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('bumps major and resets minor and patch', () => {
    expect(computeNextVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('rejects an unknown bump type', () => {
    expect(() => computeNextVersion('1.2.3', 'nope')).toThrow('Unknown bump type');
  });
});

describe('renderChangelogEntry', () => {
  it('renders an entry matching the existing CHANGELOG.md entry format exactly', () => {
    const sections = mergeSections([
      parseFragment('**Backend**\n\n- Did the backend thing.\n', 'a.md'),
      parseFragment('**Docs**\n\n- Updated the docs.\n', 'b.md'),
    ]);
    const entry = renderChangelogEntry({ version: '1.2.3', date: '2026-08-13', sections });
    expect(entry).toBe(
      '## v1.2.3\n\n2026-08-13\n\n**Backend**\n\n- Did the backend thing.\n\n**Docs**\n\n- Updated the docs.\n\n---\n\n',
    );
  });
});

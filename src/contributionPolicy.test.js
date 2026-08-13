import { describe, expect, it } from 'vitest';

import {
  findAgentAttributionViolations,
  localRange,
} from '../scripts/check-contribution-policy.mjs';

describe('contribution policy', () => {
  it('rejects agent attribution in commits and pull requests', () => {
    expect(
      findAgentAttributionViolations({
        commitMessages: [
          'fix(native): repair title bar\n\nCo-authored-by: Cursor <cursoragent@cursor.com>',
        ],
        pullRequestTitle: 'Made with Codex',
        pullRequestBody: 'Made with Cursor',
      }),
    ).toEqual([
      'commit message 1 names automated co-author Cursor',
      'pull request title attributes work to Codex',
      'pull request body attributes work to Cursor',
    ]);
  });

  it('allows human attribution and ordinary domain language', () => {
    expect(
      findAgentAttributionViolations({
        commitMessages: [
          [
            'fix(editor): preserve cursor position',
            '',
            'Calculate selection using cursor coordinates.',
            '',
            'Co-authored-by: Claude Shannon <claude@example.com>',
          ].join('\n'),
        ],
        pullRequestTitle: 'fix(editor): keep cursor visible',
        pullRequestBody: 'Keeps the text cursor visible while editing.',
      }),
    ).toEqual([]);
  });

  it('checks local feature commits against origin main', () => {
    const calls = [];
    const runGit = (args) => {
      calls.push(args);
      if (args[0] === 'rev-parse') {
        return 'main-head';
      }
      return 'branch-point';
    };

    expect(localRange(runGit)).toEqual({ base: 'branch-point', head: 'HEAD' });
    expect(calls).toEqual([
      ['rev-parse', '--verify', 'refs/remotes/origin/main'],
      ['merge-base', 'HEAD', 'refs/remotes/origin/main'],
    ]);
  });
});

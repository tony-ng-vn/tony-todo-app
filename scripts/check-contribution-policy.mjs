import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentNames = [
  ['Cursor', /\bcursor(?:agent)?\b/i],
  ['Codex', /\bcodex\b/i],
  ['ChatGPT', /\bchatgpt\b/i],
  ['Claude', /\bclaude(?:\s+code)?\b/i],
  ['Copilot', /\bcopilot\b/i],
  ['CodeRabbit', /\bcoderabbit\b/i],
  ['Gemini', /\bgemini\b/i],
  ['Windsurf', /\bwindsurf\b/i],
  ['Devin', /\bdevin\b/i],
  ['Aider', /\baider\b/i],
  ['Cline', /\bcline\b/i],
  ['Roo', /\broo\b/i],
  ['Trae', /\btrae\b/i],
  ['Augment', /\baugment\b/i],
  ['Qoder', /\bqoder\b/i],
  ['Qwen', /\bqwen\b/i],
  ['Kilocode', /\bkilocode\b/i],
];
const automatedCoauthorNames = new Set([
  'cursor',
  'cursor agent',
  'cursoragent',
  'codex',
  'chatgpt',
  'claude',
  'claude code',
  'copilot',
  'github copilot',
  'coderabbit',
  'gemini',
  'windsurf',
  'devin',
  'aider',
  'cline',
  'roo',
  'trae',
  'augment',
  'qoder',
  'qwen',
  'kilocode',
]);

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || 'git ' + args.join(' ') + ' failed');
  }
  return result.status === 0 ? result.stdout.trim() : null;
}

function readGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch (error) {
    throw new Error('Unable to read GitHub event payload: ' + error.message);
  }
}

export function localRange(runGit = git) {
  const remoteMain = runGit(['rev-parse', '--verify', 'refs/remotes/origin/main'], {
    allowFailure: true,
  });
  if (remoteMain) {
    const base = runGit(['merge-base', 'HEAD', 'refs/remotes/origin/main']);
    return { base, head: 'HEAD' };
  }

  const upstream = runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], {
    allowFailure: true,
  });
  if (upstream) {
    const base = runGit(['merge-base', 'HEAD', upstream]);
    return { base, head: 'HEAD' };
  }

  const parent = runGit(['rev-parse', 'HEAD^'], { allowFailure: true });
  return parent ? { base: parent, head: 'HEAD' } : null;
}

function contributionContext() {
  const event = readGitHubEvent();
  const pullRequest = event.pull_request;
  if (pullRequest?.base?.sha && pullRequest?.head?.sha) {
    return {
      base: pullRequest.base.sha,
      head: pullRequest.head.sha,
      pullRequestTitle: pullRequest.title ?? '',
      pullRequestBody: pullRequest.body ?? '',
    };
  }

  if (event.before && event.after && !/^0+$/.test(event.before)) {
    return {
      base: event.before,
      head: event.after,
      pullRequestTitle: '',
      pullRequestBody: '',
    };
  }

  return { ...localRange(), pullRequestTitle: '', pullRequestBody: '' };
}

function commitMessagesInRange(base, head) {
  if (!base || !head) {
    return [];
  }

  const output = git(['log', '--format=%B%x00', base + '..' + head]);
  return output ? output.split('\0').map((message) => message.trim()).filter(Boolean) : [];
}

function containsAttribution(text, agentPattern) {
  const source = agentPattern.source;
  const flags = agentPattern.flags.includes('i') ? 'im' : 'm';
  const patterns = [
    new RegExp(
      '\\b(?:made|built|generated|written|authored|created|assisted|powered)\\s+(?:with|by|using)\\s+(?:the\\s+)?' + source,
      flags,
    ),
    new RegExp(source + '[- ]generated\\b', flags),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function automatedCoauthorNamesIn(text) {
  const matches = [];
  const trailer = /^\s*(?:co-)?authored-by:\s*([^<\n]+?)\s*<[^>\n]+>/gim;
  for (const match of text.matchAll(trailer)) {
    const name = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    if (automatedCoauthorNames.has(name)) {
      matches.push(match[1].trim());
    }
  }
  return matches;
}

export function findAgentAttributionViolations({
  commitMessages,
  pullRequestTitle = '',
  pullRequestBody,
}) {
  const violations = [];
  for (const [index, message] of commitMessages.entries()) {
    for (const name of automatedCoauthorNamesIn(message)) {
      violations.push('commit message ' + (index + 1) + ' names automated co-author ' + name);
    }
    for (const [name, pattern] of agentNames) {
      if (containsAttribution(message, pattern)) {
        violations.push('commit message ' + (index + 1) + ' attributes work to ' + name);
      }
    }
  }

  for (const [field, text] of [
    ['title', pullRequestTitle],
    ['body', pullRequestBody ?? ''],
  ]) {
    for (const [name, pattern] of agentNames) {
      if (containsAttribution(text, pattern)) {
        violations.push('pull request ' + field + ' attributes work to ' + name);
      }
    }
  }

  return violations;
}

export function checkContributionPolicy() {
  const context = contributionContext();
  return findAgentAttributionViolations({
    commitMessages: commitMessagesInRange(context.base, context.head),
    pullRequestTitle: context.pullRequestTitle,
    pullRequestBody: context.pullRequestBody,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = checkContributionPolicy();
  if (violations.length > 0) {
    console.error('Contribution policy failed:');
    for (const violation of violations) {
      console.error('- ' + violation);
    }
    process.exit(1);
  }

  console.log('Contribution policy passed.');
}

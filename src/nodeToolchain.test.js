import { describe, expect, it } from 'vitest';
import {
  parseInstalledNodeMajor,
  parseRequiredNodeMajor,
} from '../scripts/check-node-toolchain.mjs';

describe('Node toolchain contract', () => {
  it('reads the required and installed Node major versions', () => {
    expect(parseRequiredNodeMajor('24\n')).toBe(24);
    expect(parseInstalledNodeMajor('v24.14.0')).toBe(24);
  });

  it('rejects malformed versions', () => {
    expect(parseRequiredNodeMajor('latest')).toBeNull();
    expect(parseInstalledNodeMajor('Node unknown')).toBeNull();
  });
});

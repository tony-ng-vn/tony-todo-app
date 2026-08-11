import { describe, expect, it } from 'vitest';
import {
  isVersionAtLeast,
  parseInstalledSwiftVersion,
  parseRequiredToolsVersion,
} from '../scripts/check-swift-toolchain.mjs';

describe('Swift toolchain contract', () => {
  it('reads the package minimum and installed compiler versions', () => {
    expect(parseRequiredToolsVersion('// swift-tools-version: 6.1')).toBe('6.1');
    expect(parseInstalledSwiftVersion('Apple Swift version 6.2.3')).toBe('6.2.3');
  });

  it('rejects an older minor compiler version', () => {
    expect(isVersionAtLeast('6.0.3', '6.1')).toBe(false);
    expect(isVersionAtLeast('6.1', '6.1')).toBe(true);
    expect(isVersionAtLeast('6.2', '6.1')).toBe(true);
  });
});

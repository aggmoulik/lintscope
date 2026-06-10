import { describe, expect, it } from 'vitest';
import { createRegistry, getAdapter, listAdapters, registerAdapter } from '../src/registry';
import type { LinterAdapter } from '../src/types';

function fakeAdapter(name: string, priority: number): LinterAdapter<unknown> {
  return {
    name,
    meta: { label: name.toUpperCase() },
    priority,
    bin: name,
    defaultPatterns: ['.'],
    installHint: `pnpm add -D ${name}`,
    detect: () => null,
    buildArgs: ({ patterns }) => patterns,
    map: () => {
      throw new Error('not under test');
    },
  };
}

describe('createRegistry', () => {
  it('registers and retrieves adapters by name', () => {
    const registry = createRegistry([fakeAdapter('alpha', 10)]);
    expect(registry.get('alpha').name).toBe('alpha');
  });

  it('lists adapters sorted by ascending priority', () => {
    const registry = createRegistry([
      fakeAdapter('slow', 30),
      fakeAdapter('fast', 10),
      fakeAdapter('mid', 20),
    ]);
    expect(registry.list().map((a) => a.name)).toEqual(['fast', 'mid', 'slow']);
  });

  it('throws for an unknown adapter, naming the registered ones', () => {
    const registry = createRegistry([fakeAdapter('alpha', 10), fakeAdapter('beta', 20)]);
    expect(() => registry.get('stylelint')).toThrow(/stylelint.*alpha, beta/s);
  });

  it('register() rejects duplicate names', () => {
    const registry = createRegistry([fakeAdapter('alpha', 10)]);
    expect(() => registry.register(fakeAdapter('alpha', 99))).toThrow(/already registered/);
  });

  it('register() makes the adapter visible to get() and list()', () => {
    const registry = createRegistry([]);
    registry.register(fakeAdapter('gamma', 10));
    expect(registry.get('gamma').name).toBe('gamma');
    expect(registry.list()).toHaveLength(1);
  });
});

describe('default registry helpers', () => {
  it('registerAdapter + getAdapter operate on the shared default registry', () => {
    const name = `test-${Math.random().toString(36).slice(2, 8)}`;
    registerAdapter(fakeAdapter(name, 50));
    expect(getAdapter(name).name).toBe(name);
    expect(listAdapters().some((a) => a.name === name)).toBe(true);
  });
});

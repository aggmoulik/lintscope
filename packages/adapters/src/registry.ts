import type { LinterAdapter } from './types';

/** A named collection of adapters with priority-ordered listing. */
export interface AdapterRegistry {
  /** Look up an adapter by name. Throws (naming the registered ones) when unknown. */
  get(name: string): LinterAdapter;
  /** All adapters, sorted by ascending `priority` (detection order). */
  list(): LinterAdapter[];
  /** Add an adapter. Throws on a duplicate name — names are the registry key. */
  register(adapter: LinterAdapter): void;
}

/** Create an isolated registry seeded with `adapters`. */
export function createRegistry(adapters: LinterAdapter[]): AdapterRegistry {
  const byName = new Map<string, LinterAdapter>();

  const register = (adapter: LinterAdapter): void => {
    if (byName.has(adapter.name)) {
      throw new Error(`Linter adapter "${adapter.name}" is already registered`);
    }
    byName.set(adapter.name, adapter);
  };

  for (const adapter of adapters) {
    register(adapter);
  }

  return {
    register,
    get(name) {
      const adapter = byName.get(name);
      if (!adapter) {
        const known = [...byName.keys()].join(', ') || 'none';
        throw new Error(`Unknown linter adapter "${name}". Registered adapters: ${known}`);
      }
      return adapter;
    },
    list() {
      return [...byName.values()].sort((a, b) => a.priority - b.priority);
    },
  };
}

/**
 * The shared default registry. Built-in adapters are seeded here by the
 * package barrel; `registerAdapter` is the extension point for external
 * adapters (post-v1.0 plugin packages call it at load time).
 */
const defaultRegistry = createRegistry([]);

export function getAdapter(name: string): LinterAdapter {
  return defaultRegistry.get(name);
}

export function listAdapters(): LinterAdapter[] {
  return defaultRegistry.list();
}

export function registerAdapter(adapter: LinterAdapter): void {
  defaultRegistry.register(adapter);
}

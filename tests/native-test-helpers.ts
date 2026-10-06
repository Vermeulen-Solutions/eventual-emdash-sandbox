/** Query-aware in-memory KV for adapter unit tests; runtime tests use real D1. */
export function memoryKv() {
  const rows = new Map<string, { value: unknown; revision: string }>();
  let revision = 0;
  return {
    get: async (key: string) => rows.get(key)?.value ?? null,
    getVersioned: async (key: string) => rows.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      rows.set(key, { value, revision: String(++revision) });
    },
    list: async (prefix = "") =>
      [...rows]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, row]) => ({ key, value: row.value })),
    compareAndSet: async (
      key: string,
      expected: string | null,
      value: unknown,
    ) => {
      if ((rows.get(key)?.revision ?? null) !== expected)
        return { applied: false };
      rows.set(key, { value, revision: String(++revision) });
      return { applied: true };
    },
    compareAndDelete: async (key: string, expected: string) => {
      if (rows.get(key)?.revision !== expected) return { applied: false };
      rows.delete(key);
      return { applied: true };
    },
  };
}

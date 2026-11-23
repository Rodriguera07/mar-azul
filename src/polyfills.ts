// Substitutos para funções de JavaScript que o Safari/iOS mais antigo não tem
// (o Chrome do Android já tem todas). Precisa ser o PRIMEIRO import do app:
// o React Navigation usa `findLast`/`findLastIndex` logo na abertura, e num
// iPhone com iOS anterior ao 15.4 isso derrubava o app inteiro (tela branca)
// enquanto no Android rodava normal. Cada substituto só é instalado se a
// função não existir, então nunca troca a implementação nativa.

type Predicate<T> = (value: T, index: number, array: T[]) => unknown;

function define(target: object, name: string, value: unknown) {
  if ((target as Record<string, unknown>)[name] !== undefined) return;
  Object.defineProperty(target, name, { value, configurable: true, writable: true });
}

// iOS < 15.4
define(Array.prototype, 'findLast', function findLast<T>(this: T[], fn: Predicate<T>, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) {
    if (fn.call(thisArg, this[i], i, this)) return this[i];
  }
  return undefined;
});

define(Array.prototype, 'findLastIndex', function findLastIndex<T>(this: T[], fn: Predicate<T>, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) {
    if (fn.call(thisArg, this[i], i, this)) return i;
  }
  return -1;
});

// iOS < 15.4
define(Array.prototype, 'at', function at<T>(this: T[], index: number) {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
});

define(String.prototype, 'at', function at(this: string, index: number) {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this.charAt(i);
});

// iOS < 13.4
define(String.prototype, 'replaceAll', function replaceAll(
  this: string,
  search: string | RegExp,
  replacement: string | ((substring: string, ...args: unknown[]) => string)
) {
  if (search instanceof RegExp) {
    if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp');
    return this.replace(search, replacement as string);
  }
  return this.split(search).join(
    typeof replacement === 'function' ? replacement(search) : String(replacement)
  );
});

// iOS < 15.4
define(Object, 'hasOwn', function hasOwn(obj: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(obj, key);
});

// iOS < 15.4 — cópia profunda de dados simples (objetos, listas, datas, mapas
// e conjuntos), que é o que as bibliotecas de animação precisam.
function cloneValue<T>(value: T, seen = new Map<unknown, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    value.forEach((v, k) => out.set(cloneValue(k, seen), cloneValue(v, seen)));
    return out as unknown as T;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    value.forEach((v) => out.add(cloneValue(v, seen)));
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    value.forEach((v, i) => {
      out[i] = cloneValue(v, seen);
    });
    return out as unknown as T;
  }
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  Object.keys(value as object).forEach((k) => {
    out[k] = cloneValue((value as Record<string, unknown>)[k], seen);
  });
  return out as T;
}

const g = globalThis as Record<string, unknown>;
if (typeof g.structuredClone !== 'function') {
  g.structuredClone = (value: unknown) => cloneValue(value);
}

// Safari não tem requestIdleCallback (nem as versões mais novas).
if (typeof g.requestIdleCallback !== 'function') {
  g.requestIdleCallback = (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) => {
    const start = Date.now();
    return setTimeout(
      () => cb({ didTimeout: false, timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) }),
      1
    );
  };
  g.cancelIdleCallback = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
}

export {};

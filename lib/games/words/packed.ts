/**
 * Fixed-width packed word lists. Every word of one length is concatenated, in
 * sorted order, into a single string with no separators ("aboutabove..."), so
 * a list costs exactly `length` bytes per word before gzip and needs no parsing
 * at startup: lookup is a binary search straight over the string.
 */

/** Read-only view over a set of words. */
export interface WordList {
  readonly size: number;
  /** The i-th word (0 <= i < size), lowercase. */
  at(i: number): string;
  /** Membership test; case-insensitive. */
  has(word: string): boolean;
  /** Every word as an array (allocates; prefer `at` / `has` in hot paths). */
  toArray(): string[];
}

export class PackedWords implements WordList {
  readonly size: number;

  constructor(
    readonly packed: string,
    readonly length: number,
  ) {
    if (packed.length % length !== 0) {
      throw new Error(`packed list length ${packed.length} is not a multiple of ${length}`);
    }
    this.size = packed.length / length;
  }

  at(i: number): string {
    const L = this.length;
    return this.packed.slice(i * L, i * L + L);
  }

  /** Index of `word`, or -1. */
  indexOf(word: string): number {
    const L = this.length;
    if (word.length !== L) return -1;
    const w = word.toLowerCase();
    let lo = 0;
    let hi = this.size - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const cand = this.packed.slice(mid * L, mid * L + L);
      if (cand === w) return mid;
      if (cand < w) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  has(word: string): boolean {
    return this.indexOf(word) !== -1;
  }

  toArray(): string[] {
    const out = new Array<string>(this.size);
    for (let i = 0; i < this.size; i++) out[i] = this.at(i);
    return out;
  }
}

/** Union of disjoint lists, indexed in order (all of the first, then the second, ...). */
export class UnionWords implements WordList {
  readonly size: number;

  constructor(readonly parts: readonly WordList[]) {
    this.size = parts.reduce((n, p) => n + p.size, 0);
  }

  at(i: number): string {
    for (const p of this.parts) {
      if (i < p.size) return p.at(i);
      i -= p.size;
    }
    throw new RangeError(`index out of range`);
  }

  has(word: string): boolean {
    return this.parts.some((p) => p.has(word));
  }

  toArray(): string[] {
    return this.parts.flatMap((p) => p.toArray());
  }
}

/**
 * Pack words of one length: lowercase a-z, sorted, de-duplicated. Inverse of
 * `new PackedWords(s, length).toArray()`. Used by the build script and tests.
 */
export function packWords(words: Iterable<string>, length: number): string {
  const set = new Set<string>();
  for (const w of words) {
    if (w.length !== length || !/^[a-z]+$/.test(w)) {
      throw new Error(`cannot pack ${JSON.stringify(w)} as a ${length}-letter word`);
    }
    set.add(w);
  }
  return [...set].sort().join("");
}

/**
 * Seeded random numbers: the Park-Miller "minimal standard" generator the game has always used,
 * so a given seed produces exactly the same world and rolls as before.
 */
export class Rng {
  constructor(private seed = 1) {}

  reseed(seed: number): void {
    this.seed = seed;
  }

  /** A number in [0, 1). */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** An integer in [a, b], inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}

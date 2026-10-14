/**
 * A small, typed Entity-Component-System store.
 *
 * Entities are plain numbers. Components are plain data objects, one store per component type,
 * described by a ComponentMap ({ transform: Transform, health: Health, ... }). Systems are ordinary
 * functions that query the world for entities with a set of components and act on them.
 */
export type Entity = number;

type Stores<C> = { [K in keyof C]: Map<Entity, C[K]> };

export class World<C extends object> {
  private nextId = 1;
  private readonly alive = new Set<Entity>();
  private readonly stores = {} as Stores<C>;

  private store<K extends keyof C>(key: K): Map<Entity, C[K]> {
    return (this.stores[key] ??= new Map<Entity, C[K]>());
  }

  /** Create an entity, optionally with an initial set of components. */
  create(components: Partial<C> = {}): Entity {
    const e = this.nextId++;
    this.alive.add(e);
    for (const key of Object.keys(components) as (keyof C)[]) {
      const value = components[key];
      if (value !== undefined) this.store(key).set(e, value as C[typeof key]);
    }
    return e;
  }

  /** Remove an entity and all of its components. Safe to call while iterating a query. */
  destroy(e: Entity): void {
    if (!this.alive.delete(e)) return;
    for (const key of Object.keys(this.stores) as (keyof C)[]) this.stores[key].delete(e);
  }

  isAlive(e: Entity): boolean {
    return this.alive.has(e);
  }

  add<K extends keyof C>(e: Entity, key: K, value: C[K]): C[K] {
    this.store(key).set(e, value);
    return value;
  }

  get<K extends keyof C>(e: Entity, key: K): C[K] | undefined {
    return this.stores[key]?.get(e);
  }

  /** Get a component that must exist (throws if it doesn't, which is a programming error). */
  need<K extends keyof C>(e: Entity, key: K): C[K] {
    const value = this.stores[key]?.get(e);
    if (value === undefined) throw new Error(`Entity ${e} has no ${String(key)} component`);
    return value;
  }

  has<K extends keyof C>(e: Entity, key: K): boolean {
    return this.stores[key]?.has(e) ?? false;
  }

  remove<K extends keyof C>(e: Entity, key: K): void {
    this.stores[key]?.delete(e);
  }

  /** How many entities have a component. */
  count<K extends keyof C>(key: K): number {
    return this.stores[key]?.size ?? 0;
  }

  /**
   * Every entity that has all of the given components, with those components.
   * Iterates a snapshot, so destroying entities mid-loop is safe.
   *
   *   for (const [e, { transform, health }] of world.query("transform", "health")) ...
   */
  query<K extends keyof C>(...keys: K[]): [Entity, Pick<C, K>][] {
    const sizes = keys.map(k => this.stores[k]?.size ?? 0);
    const smallest = keys[sizes.indexOf(Math.min(...sizes))];
    if (smallest === undefined) return [];
    const out: [Entity, Pick<C, K>][] = [];
    for (const e of this.store(smallest).keys()) {
      const picked = {} as Pick<C, K>;
      let ok = true;
      for (const k of keys) {
        const v = this.stores[k]?.get(e);
        if (v === undefined) { ok = false; break; }
        picked[k] = v;
      }
      if (ok) out.push([e, picked]);
    }
    return out;
  }

  /** Every live entity (a snapshot, so destroying while iterating is safe). */
  entities(): Entity[] {
    return [...this.alive];
  }

  /** Remove every entity. */
  clear(): void {
    this.alive.clear();
    for (const key of Object.keys(this.stores) as (keyof C)[]) this.stores[key].clear();
  }
}

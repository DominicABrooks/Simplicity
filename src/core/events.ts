/**
 * A typed publish/subscribe bus. Gameplay emits ("toast", "combatText", ...) without knowing who
 * listens; the UI subscribes. Keeps systems free of DOM code, so they run in tests.
 */
export class EventBus<Events extends object> {
  private readonly handlers: { [K in keyof Events]?: ((payload: Events[K]) => void)[] } = {};

  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    const list = (this.handlers[type] ??= []);
    list.push(handler);
    return () => list.splice(list.indexOf(handler), 1);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const handler of this.handlers[type] ?? []) handler(payload);
  }
}

import type {EventualContext} from '../storage';
const requests = new WeakMap<EventualContext, Record<string, Promise<unknown>>>();
export function requestMemo<T>(ctx: EventualContext, key: string, load: () => T | Promise<T>): Promise<T> {
  let cache = requests.get(ctx);
  if (!cache) requests.set(ctx, cache = Object.create(null) as Record<string, Promise<unknown>>);
  return (cache[key] ??= Promise.resolve().then(load)) as Promise<T>;
}
export function forgetRequestMemo(ctx: EventualContext, key: string) { const cache = requests.get(ctx); if (cache) delete cache[key]; }

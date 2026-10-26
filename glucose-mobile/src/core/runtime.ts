let idFactory: () => string = () => globalThis.crypto.randomUUID();
export function setIdFactory(factory: () => string) { idFactory = factory; }
export function uuid() { return idFactory(); }
/** Domain snapshots contain JSON data only; works on Hermes and browsers. */
export function cloneData<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

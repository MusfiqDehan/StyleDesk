import { tenantStorage } from './tenant-context.js';

/** Isolate initialized mutable fields while sharing injected Nest services/repositories. */
export function DeviceState(): ClassDecorator {
  return ((Original: any) => {
    const Wrapped = class extends Original {
      constructor(...args: any[]) {
        super(...args);
        const initial = new Map<PropertyKey, any>();
        for (const key of Object.keys(this)) {
          const value = (this as any)[key];
          if (value === null || typeof value !== 'object' || value instanceof Map || value instanceof Set || value instanceof Promise || Array.isArray(value)) initial.set(key, value);
        }
        const states = new Map<string, Map<PropertyKey, any>>();
        const state = () => {
          const scope = tenantStorage.getStore();
          if (!scope) return null;
          const id = `${scope.tenantId}:${scope.branchId}:${scope.deviceId ?? 'none'}`;
          let values = states.get(id);
          if (!values) {
            values = new Map([...initial].map(([key, value]) => [key, value instanceof Map ? new Map() : value instanceof Set ? new Set() : Array.isArray(value) ? [] : value]));
            states.set(id, values);
          }
          return values;
        };
        return new Proxy(this, {
          get(target, key, receiver) { const values = initial.has(key) ? state() : null; return values ? values.get(key) : Reflect.get(target,key,receiver); },
          set(target, key, value, receiver) { const values = initial.has(key) ? state() : null; if (values) { values.set(key,value); return true; } return Reflect.set(target,key,value,receiver); },
        });
      }
    };
    // Preserve constructor injection metadata used by Nest.
    for (const key of Reflect.getMetadataKeys(Original)) Reflect.defineMetadata(key, Reflect.getMetadata(key,Original), Wrapped);
    return Wrapped;
  }) as ClassDecorator;
}

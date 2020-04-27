export interface CacheClient {
    get(key: string, cb: (err: Error, value: string) => unknown);
    set(key: string, value: string, mode: string, ttl: number, cb?: (err: Error, response: unknown) => unknown);
}

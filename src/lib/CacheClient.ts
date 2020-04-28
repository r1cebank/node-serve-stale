export interface CacheClient {
  get(key: string): Promise<string>;
  set(key: string, value: string, ttl: number): boolean;
}

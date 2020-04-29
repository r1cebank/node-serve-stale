import crypto from 'crypto';
import shortid from 'shortid';
import Axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import NodeCache from 'node-cache';
import { FetcherOptions } from './FetcherOptions';
import { ResponseHandler } from './ResponseHandler';
import { CacheClient } from './CacheClient';
import { Logger } from 'pino';
import { RefreshConfig } from './RefreshConfig';

/**
 * Creates a fetcher that does stale fetch
 */
export class StaleFetcher {
  private axiosInstance: AxiosInstance;
  private cacheClient: CacheClient;
  private refreshCache: NodeCache;
  private logger?: Logger;
  private instanceId: string;
  private hashHandlers: ResponseHandler;
  private cacheTTL: number;
  /**
   * Creates a stale fetcher
   * @param {FetcherOptions} options Fetcher Options
   */
  constructor(options: FetcherOptions) {
    this.axiosInstance = Axios.create(options.axiosOptions);
    this.cacheClient = options.cacheClient;
    this.logger = options.logger;
    this.instanceId = shortid();
    this.hashHandlers = <ResponseHandler>{};
    this.cacheTTL = options.cacheTTL;
    this.refreshCache = new NodeCache({
      stdTTL: options.refreshInterval / 1000,
      checkperiod: 1
    });

    this.refreshCache.on('expired', (key: string, value: RefreshConfig) => {
      this.onCacheExpire(key, value);
    });
  }
  /**
   * Handler for on cache expire
   * @param {string} key cache key
   * @param {RefreshConfig} value expired key valuw
   */
  private async onCacheExpire(key: string, value: RefreshConfig) {
    const { url, options, backoff } = value;
    this.logger?.info(`Refreshing request cache key ${key}`);
    try {
      const { data } = await this.axiosInstance.get(url, options);
      this.store(key, JSON.stringify(data), this.cacheTTL, value);
    } catch (error) {
      this.logger?.error('Refresh failure', { key, url });
      // Exponential backoff
      if (backoff > 65536) {
        this.logger?.error('Exceeded backoff time, cancelling update');
      } else {
        const newTTL = backoff + backoff * 2;
        this.refreshCache.set(key, {
          ...value,
          backoff: newTTL
        }, newTTL);
      }
    }
  }
  /**
   * Caculate hash for the request
   * @param {string} url Url for the requst
   * @param {AxiosRequestConfig} options request options
   * @return {string}
   */
  private calculateHash(url: string, options?: AxiosRequestConfig): string {
    const hasher = crypto.createHash('sha256');
    hasher.update(url);
    if (options) {
      hasher.update(JSON.stringify(options.headers));
    }
    const requestHash = hasher.digest('hex');
    return `${this.instanceId}-${requestHash}`;
  }
  /**
   * Set a cache entry and create refresh job
   * @param {string} key cache key
   * @param {string} value cache value
   * @param {number} ttl time to live
   * @param {RefreshConfig} config how to refresh the cache
   */
  private store(
    key: string,
    value: string,
    ttl: number,
    config: RefreshConfig
  ) {
    this.cacheClient.set(key, value, ttl);
    this.refreshCache.set(key, config);
  }
  /**
   * Request the resource using GET
   * @param {string} url Request url
   * @param {AxiosRequestConfig} options Request options
   */
  public async get<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
    const requestHash = this.calculateHash(url, options);
    this.logger?.info(`Request for ${url}`);

    return new Promise<T>(async (resolve, reject) => {
      try {
        const value = await this.cacheClient.get(requestHash);
        if (value) {
          this.logger?.info('Request found in redis');
          resolve(<T>JSON.parse(value));
        } else {
          // Request is not found
          const handlers = this.hashHandlers[requestHash];
          if (handlers) {
            this.logger?.info('Request pending, adding handlers');
            handlers.push((response: unknown) => {
              resolve(<T>response);
            });
          } else {
            this.logger?.info('New request, creating new handler');
            this.hashHandlers[requestHash] = [
              (response: unknown) => {
                resolve(<T>response);
              }
            ];
            this.axiosInstance.get<T>(url, options).then((response) => {
              const { data } = response;
              this.logger?.info('Responding to all handlers');
              this.hashHandlers[requestHash].map((handler) => {
                handler(data);
              });
              delete this.hashHandlers[requestHash];
              this.store(requestHash, JSON.stringify(data), this.cacheTTL, {
                url,
                options,
                backoff: 0
              });
            }).catch((error) => {
              reject(error);
            });
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

import crypto from 'crypto';
import shortid from 'shortid';
import Axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { FetcherOptions } from "./FetcherOptions";
import { ResponseHandler } from './ResponseHandler';
import { CacheClient } from './CacheClient';
import { Logger } from 'pino';

export class StaleFetcher {
    private axiosInstance: AxiosInstance;
    private cacheClient: CacheClient;
    private logger?: Logger;
    private instanceId: string;
    private hashHandlers: ResponseHandler;
    private cacheTTL: number;
    private refreshInterval: number;
    constructor(options: FetcherOptions) {
        this.axiosInstance = Axios.create(options.axiosOptions);
        this.cacheClient = options.cacheClient;
        this.logger = options.logger;
        this.instanceId = shortid();
        this.hashHandlers = <ResponseHandler>{};
        this.cacheTTL = options.cacheTTL;
        this.refreshInterval = options.refreshInterval;
    }
    private calculateHash(url: string, options?: AxiosRequestConfig): string {
        const hasher = crypto.createHash('sha256');
        hasher.update(url);
        if (options) {
            hasher.update(options.headers);
        }
        const requestHash = hasher.digest('hex');
        return `${this.instanceId}-${requestHash}`;
    }
    public async get<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
        const requestHash = this.calculateHash(url, options);
        this.logger?.info(`Request for ${url}`);

        return new Promise<T>((resolve, reject) => {
            this.cacheClient.get(requestHash, (error?: Error, value?: string) => {
                if (error) {
                    this.logger?.error('Error getting from redis', error);
                    reject(error);
                }
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
                        this.hashHandlers[requestHash] = [(response: unknown) => {
                            resolve(<T>response);
                        }];
                        this.axiosInstance.get<T>(url, options).then((response) => {
                            const { data } = response;
                            this.logger?.info('Responding to all handlers');
                            this.hashHandlers[requestHash].map((handler) => {
                                handler(data);
                            });
                            delete this.hashHandlers[requestHash];
                            this.cacheClient.set(requestHash, JSON.stringify(data), 'PX', this.cacheTTL);
                            setInterval(async () => {
                                this.logger?.info('Refreshing request cache');
                                const { data } = await this.axiosInstance.get(url, options);
                                this.cacheClient.set(requestHash, JSON.stringify(data), 'PX', this.cacheTTL);
                            }, this.refreshInterval);
                        });
                    }
                }
            });
        });
    }
}

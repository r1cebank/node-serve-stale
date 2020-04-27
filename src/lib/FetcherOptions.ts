import { AxiosRequestConfig } from 'axios';
import { Logger } from 'pino';
import { CacheClient } from './CacheClient';

export interface FetcherOptions {
    axiosOptions: AxiosRequestConfig;
    cacheClient: CacheClient;
    logger?: Logger
    cacheTTL: number;
    refreshEnabled: boolean;
    refreshInterval: number;
}

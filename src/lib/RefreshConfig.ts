import { AxiosRequestConfig } from 'axios';

export type RefreshConfig = {
  url: string;
  backoff: number;
  options?: AxiosRequestConfig;
};

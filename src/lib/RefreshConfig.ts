import { AxiosRequestConfig } from 'axios';

export type RefreshConfig = {
  url: string;
  options?: AxiosRequestConfig;
};

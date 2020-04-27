// import redis from 'redis';
// import Pino from 'pino';

// import { StaleFetcher } from './lib/StaleFetcher';

// const client = redis.createClient();
// const logger = Pino();

// client.on('error', (error) => {
//   console.error(error);
// });

// const hash = '450b96cc619deb24a5f4';

// const fetcher = new StaleFetcher({
//     logger,
//     cacheClient: client,
//     cacheTTL: 10 * 1000,
//     refreshEnabled: true,
//     refreshInterval: 5000,
//     axiosOptions: {
//         baseURL: 'https://api.npoint.io'
//     }
// });

// async function run() {
//     const range = [];
//     for (let i = 0; i < 100; i++) {
//         range.push(i);
//     }
//     const allresult = await Promise.all(range.map(() => fetcher.get(hash)));
//     console.log(allresult);
//     const data = await fetcher.get(hash);
//     console.log(data);
// }

// run();

export * from './lib/StaleFetcher';
export * from './lib/CacheClient';
export * from './lib/FetcherOptions';

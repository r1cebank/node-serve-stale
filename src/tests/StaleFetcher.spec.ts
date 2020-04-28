import test from 'ava';
import { stub } from 'sinon';
import Axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse } from 'axios';
import { StaleFetcher } from '../index';
import { Logger } from 'pino';

const wait = async (sec: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, sec * 1000);
  });
};

test.serial('Should fetch correctly from axios', async t => {
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>{
    get: async (url) => {
      return {
        data: { url }
      };
    }
  });
  const logStub = stub();
  const cacheClient = {
    get: stub().resolves(''),
    set: () => {
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    logger: <Logger>(<unknown>{
      info: logStub
    }),
    refreshEnabled: true,
    refreshInterval: 1000
  });

  const data = await staleFetcher.get('some');
  t.deepEqual(data, { url: 'some' });
  t.true(logStub.called);
  createStub.restore();
});

test.serial('Should reject if cache fails', async t => {
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: stub().resolves({ data: 'some' })
  }));
  const cacheClient = {
    get: stub().rejects(new Error('some error')),
    set: () => {
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    refreshEnabled: true,
    refreshInterval: 1000
  });

  const error = await t.throwsAsync(staleFetcher.get('some'));
  t.is(error.message, 'some error');
  createStub.restore();
});

test.serial('Should reject if axios fails', async t => {
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: stub().rejects(new Error('some error'))
  }));
  const cacheClient = {
    get: stub().resolves(''),
    set: () => {
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    refreshEnabled: true,
    refreshInterval: 1000
  });

  const error = await t.throwsAsync(staleFetcher.get('some'));
  t.is(error.message, 'some error');
  createStub.restore();
});

test.serial('Should read from cache if exist', async t => {
  const getStub = stub().resolves(<AxiosResponse>{});
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: getStub
  }));
  const logStub = stub();
  const cacheClient = {
    get: stub().resolves(JSON.stringify({ data: 'data' })),
    set: () => {
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    logger: <Logger>(<unknown>{
      info: logStub
    }),
    refreshEnabled: true,
    refreshInterval: 1000
  });

  const data = await staleFetcher.get('some');
  t.deepEqual(data, { data: 'data' });
  t.false(getStub.called);
  t.true(logStub.called);
  createStub.restore();
});

test.serial('Should serve concurrent requests', async t => {
  const getStub = stub().returns(wait(1).then(() => {
    return <AxiosResponse>{
      data: { data: 'some' }
    };
  }));
  const logStub = stub();
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: getStub
  }));
  const cache = new Map<string, string>();
  const cacheClient = {
    get: async (key: string) => {
      return cache.get(key) || '';
    },
    set: (key: string, value: string) => {
      cache.set(key, value);
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    logger: <Logger>(<unknown>{
      info: logStub
    }),
    refreshEnabled: true,
    refreshInterval: 100000
  });

  const range = [];
  for (let i = 0; i < 100; i++) {
    range.push(i);
  }

  const values = await Promise.all(range.map(() => staleFetcher.get('some')));

  t.is(values.length, 100);
  t.is(getStub.callCount, 1);
  t.true(logStub.called);
  values.map((value) => {
    t.deepEqual(value, { data: 'some' });
  });
  createStub.restore();
});

test.serial('Should calculate correct hash', async t => {
  const getStub = stub().returns(wait(1).then(() => {
    return <AxiosResponse>{
      data: { data: 'some' }
    };
  }));
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: getStub
  }));
  const cacheClient = {
    get: stub().resolves(''),
    set: stub()
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    refreshEnabled: true,
    refreshInterval: 100000
  });

  const data = await staleFetcher.get('some', {
    headers: { apiKey: '12' }
  });
  t.deepEqual(data, { data: 'some' });
  t.true(getStub.called);
  t.is(cacheClient.set.getCalls()[0].args[0].split('-').length, 2);
  createStub.restore();
});

test.serial('Should refetch before expire', async t => {
  const getStub = stub().resolves(<AxiosResponse>{
    data: { url: 'some' }
  });
  const createStub = stub(Axios, 'create').returns(<AxiosInstance>(<unknown>{
    get: getStub
  }));
  const cacheClient = {
    get: stub().resolves(''),
    set: () => {
      return true;
    }
  };
  const staleFetcher = new StaleFetcher({
    axiosOptions: <AxiosRequestConfig>{},
    cacheClient: cacheClient,
    cacheTTL: 1000,
    refreshEnabled: true,
    refreshInterval: 2000
  });

  const data = await staleFetcher.get('somedata');
  t.deepEqual(data, { url: 'some' });
  await wait(8);
  t.true(getStub.callCount > 1);
  createStub.restore();
});

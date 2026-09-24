import 'reflect-metadata';
import type { INestApplication, NestApplicationOptions, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type BunAdapterOptions, type NestBunApplication } from '../src/index.js';

export interface TestApp {
  app: NestBunApplication;
  adapter: BunAdapter;
  url: string;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  json: <T = any>(path: string, init?: RequestInit) => Promise<{ status: number; body: T; headers: Headers }>;
  close: () => Promise<void>;
}

export async function bootstrap(
  module: Type<unknown>,
  opts: {
    adapter?: BunAdapterOptions;
    app?: NestApplicationOptions;
    configure?: (app: NestBunApplication, adapter: BunAdapter) => unknown;
  } = {},
): Promise<TestApp> {
  const adapter = new BunAdapter(opts.adapter);
  const app = await NestFactory.create<NestBunApplication>(module, adapter, { logger: false, ...opts.app });
  await opts.configure?.(app, adapter);
  await app.listen(0);
  const url = await app.getUrl();
  const doFetch = (path: string, init?: RequestInit) => fetch(url + path, init);
  return {
    app,
    adapter,
    url,
    fetch: doFetch,
    json: async (path, init) => {
      const res = await doFetch(path, init);
      const text = await res.text();
      let body: any = text;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        /* keep text */
      }
      return { status: res.status, body, headers: res.headers };
    },
    close: () => app.close(),
  };
}

export const jsonInit = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

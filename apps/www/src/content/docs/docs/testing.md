---
title: Testing without a port
description: Run requests through the full Nest pipeline in-process with adapter.fetch().
---

supertest needs a Node `http.Server`, which does not exist on Bun's native server. The adapter offers something simpler: hand it a Web `Request` and get a Web `Response` back, with the whole Nest pipeline (middleware, guards, pipes, interceptors, filters) in between and no socket involved.

## Unit-style, with `@nestjs/testing`

```ts title="users.e2e.test.ts"
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BunAdapter } from '@nestbun/platform';
import { AppModule } from '../src/app.module.js';

const adapter = new BunAdapter();
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication(adapter, { logger: false });
  await app.init(); // no listen()
});

afterAll(() => app.close());

it('creates a user', async () => {
  const res = await adapter.fetch(
    new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    }),
  );
  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({ name: 'Ada' });
});
```

The host in the URL does not matter; only the path, method, headers and body are used.

## Over a real socket

When you want the real thing, listen on port 0 and use `fetch`:

```ts
await app.listen(0);
const url = await app.getUrl();
const res = await fetch(`${url}/users`);
```

## Server-Sent Events in tests

`adapter.fetch()` returns a streaming `Response` for SSE routes, so you can read events with the standard stream API:

```ts
const res = await adapter.fetch(new Request('http://localhost/events'));
const reader = res.body!.getReader();
const { value } = await reader.read();
expect(new TextDecoder().decode(value)).toContain('data:');
await reader.cancel(); // simulates the client disconnecting
```

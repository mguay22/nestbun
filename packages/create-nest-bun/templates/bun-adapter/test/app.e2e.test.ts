import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BunAdapter } from '@nestbun/platform';
import { AppModule } from '../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(new BunAdapter());
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.listen(0); // random free port
    url = await app.getUrl();
  });

  afterAll(() => app.close());

  it('GET / → Hello World!', async () => {
    const res = await fetch(`${url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('POST /greet validates the body with Zod', async () => {
    const ok = await fetch(`${url}/greet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    });
    expect(await ok.json()).toEqual({ message: 'Hello, Ada!' });

    const bad = await fetch(`${url}/greet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(bad.status).toBe(400);
  });
});

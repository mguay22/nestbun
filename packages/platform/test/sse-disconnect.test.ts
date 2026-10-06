import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Module, Sse, type MessageEvent } from '@nestjs/common';
import { finalize, interval, map, type Observable } from 'rxjs';
import { bootstrap, type TestApp } from './helpers.js';

let torndown: () => void = () => {};

@Controller()
class EventsController {
  @Sse('events')
  events(): Observable<MessageEvent> {
    // Never completes on its own: only a client disconnect can end it.
    return interval(10).pipe(
      map((i) => ({ data: { tick: i } })),
      finalize(() => torndown()),
    );
  }
}
@Module({ controllers: [EventsController] })
class EventsModule {}

describe('Server-Sent Events: disconnect detection', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(EventsModule);
  });
  afterAll(() => t.close());

  it('unsubscribes from the observable when the client goes away', async () => {
    const unsubscribed = new Promise<void>((resolve) => (torndown = resolve));
    const controller = new AbortController();
    const r = await t.fetch('/events', { signal: controller.signal });
    expect(r.status).toBe(200);

    // Nest writes a bare newline first; read until the first event arrives.
    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('data: {"tick":0}')) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value);
    }
    expect(received).toContain('data: {"tick":0}');

    controller.abort();
    const timedOut = Bun.sleep(1000).then(() => 'timed out');
    expect(await Promise.race([unsubscribed.then(() => 'unsubscribed'), timedOut])).toBe(
      'unsubscribed',
    );
  });
});

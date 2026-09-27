import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TerminusModule,
} from '@nestjs/terminus';
import { bootstrap, type TestApp } from './helpers.js';

@Injectable()
class QueueIndicator {
  healthy = true;
  constructor(private readonly indicator: HealthIndicatorService) {}

  check() {
    const status = this.indicator.check('queue');
    return this.healthy ? status.up() : status.down({ reason: 'broker unreachable' });
  }
}

@Controller('health')
class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly queue: QueueIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.queue.check()]);
  }
}
@Module({ imports: [TerminusModule], controllers: [HealthController], providers: [QueueIndicator] })
class HealthModule {}

describe('@nestjs/terminus', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(HealthModule);
  });
  afterAll(() => t.close());

  it('answers 200 while every indicator is up', async () => {
    const res = await t.json('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.details.queue.status).toBe('up');
  });

  it('answers 503 with the failing indicator in the body', async () => {
    t.app.get(QueueIndicator).healthy = false;
    const res = await t.json('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.queue).toEqual({ status: 'down', reason: 'broker unreachable' });
  });
});

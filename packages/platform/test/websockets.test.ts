import { afterEach, describe, expect, it } from 'bun:test';
import { Controller, Get, Module, type LoggerService } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { bootstrap, type TestApp } from './helpers.js';

@WebSocketGateway({ path: '/ws' })
class EchoGateway {
  @SubscribeMessage('echo')
  echo(@MessageBody() data: unknown) {
    return { event: 'echo', data };
  }
}

@Controller()
class RootController {
  @Get()
  root() {
    return { ok: true };
  }
}

@Module({ controllers: [RootController], providers: [EchoGateway] })
class GatewayModule {}

@Module({ controllers: [RootController] })
class HttpOnlyModule {}

function spyLogger(): LoggerService & { warnings: string[] } {
  const warnings: string[] = [];
  const noop = () => {};
  return {
    warnings,
    log: noop,
    error: noop,
    debug: noop,
    verbose: noop,
    fatal: noop,
    warn: (message: unknown) => void warnings.push(String(message)),
  };
}

const upgradeWarnings = (logger: { warnings: string[] }) =>
  logger.warnings.filter((w) => w.includes("'upgrade'"));

describe('@nestjs/platform-ws (unsupported)', () => {
  let t: TestApp | undefined;
  afterEach(async () => {
    await t?.close();
    t = undefined;
  });

  it('warns once when a WsAdapter gateway hooks the upgrade event, and HTTP keeps working', async () => {
    const logger = spyLogger();
    t = await bootstrap(GatewayModule, {
      app: { logger },
      configure: (app) => app.useWebSocketAdapter(new WsAdapter(app)),
    });

    expect(upgradeWarnings(logger)).toHaveLength(1);
    expect(upgradeWarnings(logger)[0]).toContain('@nestjs/platform-ws');
    expect((await t.json('/')).body).toEqual({ ok: true });
  });

  it('does not warn for an HTTP-only app', async () => {
    const logger = spyLogger();
    t = await bootstrap(HttpOnlyModule, { app: { logger } });

    expect(upgradeWarnings(logger)).toHaveLength(0);
  });
});

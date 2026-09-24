---
title: Configuration
description: BunAdapter options and the Bun.serve() settings it forwards.
---

```ts
new BunAdapter({
  trustProxy: true,
  bodyLimit: '1mb',
  serve: {
    idleTimeout: 120,
    maxRequestBodySize: 128 * 1024 * 1024,
    shutdownTimeout: 10_000,
    reusePort: true,
  },
});
```

## Adapter options

| Option | Default | What it does |
|---|---|---|
| `trustProxy` | `false` | Use `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` for `req.ip`, `req.protocol` and `req.hostname`. Turn on behind a load balancer. |
| `bodyLimit` | `'100kb'` | Size limit for the built-in JSON and urlencoded parsers, matching Express. Bodies over the limit get a `413`. |
| `serve` | | Options forwarded to `Bun.serve()`, below. |

## `serve` options

| Option | Default | What it does |
|---|---|---|
| `idleTimeout` | `120` | Seconds a connection may sit idle before Bun closes it. Max 255, `0` disables. Bun's own default is 10, which is too short for slow handlers. |
| `maxRequestBodySize` | 128 MiB | Hard cap enforced by Bun before the adapter sees the body. |
| `shutdownTimeout` | `10000` | Milliseconds `app.close()` waits for in-flight requests before dropping them. |
| `reusePort` | `false` | Let several processes bind the same port (cluster mode). |
| `tls` | | TLS options. Set automatically from Nest's `httpsOptions`. |
| `development` | | Bun's development mode (verbose errors). |

## Nest application options

These `NestFactory.create()` options are honored:

- `httpsOptions` maps `key`, `cert`, `ca` and `passphrase` to Bun's TLS config.
- `rawBody: true` exposes the unparsed body as `req.rawBody` (a `Buffer`).
- `bodyParser: false` skips the default parsers.
- `forceCloseConnections: true` drops in-flight requests on `app.close()` instead of draining.
- `return503OnClosing: true` answers `503` with `Connection: close` while shutting down.
- `cors` and `app.enableCors()` use the `cors` package with the same options as Express.

## Listening

```ts
await app.listen(3000);                 // all interfaces
await app.listen(3000, '127.0.0.1');    // one interface
await app.listen(0);                    // random free port; read it with app.getUrl()
await app.listen('/tmp/api.sock');      // unix socket
```

`app.getHttpServer()` returns a `BunHttpServer`: an `EventEmitter` with `listen`, `close`, `address()` and a `bun` property holding the live `Bun.serve()` instance.

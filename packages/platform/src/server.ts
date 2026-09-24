import { EventEmitter } from 'node:events';
import type { Server, TLSOptions } from 'bun';

export type FetchHandler = (request: Request, server: Server<unknown>) => Response | Promise<Response>;

/** Options forwarded to `Bun.serve()`. */
export interface BunServeOptions {
  /** Seconds a connection may sit idle before Bun closes it (max 255, 0 disables). Default 120. */
  idleTimeout?: number;
  /** Hard cap on request bodies, in bytes. Default 128 MiB (Bun's default). */
  maxRequestBodySize?: number;
  /** TLS options; set automatically from Nest's `httpsOptions`. */
  tls?: TLSOptions;
  reusePort?: boolean;
  development?: boolean;
  /** Max milliseconds a graceful `close()` waits for in-flight requests before forcing. Default 10000. */
  shutdownTimeout?: number;
}

export interface ServerAddress {
  address: string;
  family: 'IPv4' | 'IPv6';
  port: number;
}

/**
 * Wraps `Bun.serve()` in the parts of the Node `net.Server` API that Nest's
 * core touches: `listen`, `close`, `address`, and the `'error'`/`'listening'`
 * events. `getHttpServer()` returns this.
 */
export class BunHttpServer extends EventEmitter {
  /** The live `Bun.serve()` instance once listening. */
  bun: Server<unknown> | null = null;
  private unixPath: string | null = null;
  private closing = false;

  constructor(
    private readonly fetchHandler: FetchHandler,
    private readonly options: BunServeOptions = {},
  ) {
    super();
  }

  get listening(): boolean {
    return this.bun !== null;
  }

  listen(port: number | string, hostname?: string, callback?: (err?: Error) => void): this {
    this.closing = false;
    if (this.bun) {
      const err = new Error('Server is already listening');
      callback ? callback(err) : this.emit('error', err);
      return this;
    }
    const { shutdownTimeout: _shutdownTimeout, ...serveOptions } = this.options;
    const base = {
      idleTimeout: 120,
      ...serveOptions,
      fetch: async (request: Request, server: Server<unknown>) => {
        const response = await this.fetchHandler(request, server);
        // While draining, ask clients to drop their keep-alive connections.
        if (this.closing) {
          try {
            response.headers.set('connection', 'close');
          } catch {
            /* immutable headers */
          }
        }
        return response;
      },
      error: (error: Error) => {
        this.emit('clientError', error);
        return new Response('Internal Server Error', { status: 500 });
      },
    };
    try {
      if (typeof port === 'string' && !/^\d+$/.test(port)) {
        this.unixPath = port;
        this.bun = Bun.serve({ ...base, unix: port } as never);
      } else {
        this.bun = Bun.serve({ ...base, port: Number(port), hostname } as never);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.listenerCount('error') > 0) this.emit('error', err);
      else if (callback) callback(err);
      else throw err;
      return this;
    }
    this.emit('listening');
    callback?.();
    return this;
  }

  /** Node-compatible: `{ address, family, port }`, a path for unix sockets, or `null` when not listening. */
  address(): ServerAddress | string | null {
    if (!this.bun) return null;
    if (this.unixPath) return this.unixPath;
    const address = this.bun.hostname ?? '0.0.0.0';
    return { address, family: address.includes(':') ? 'IPv6' : 'IPv4', port: this.bun.port ?? 0 };
  }

  close(callback?: (err?: Error) => void): this;
  close(force: boolean, callback?: (err?: Error) => void): this;
  close(forceOrCb?: boolean | ((err?: Error) => void), maybeCb?: (err?: Error) => void): this {
    const force = typeof forceOrCb === 'boolean' ? forceOrCb : false;
    const callback = typeof forceOrCb === 'function' ? forceOrCb : maybeCb;
    if (!this.bun) {
      callback?.(new Error('Server is not running'));
      return this;
    }
    const server = this.bun;
    this.bun = null;
    this.unixPath = null;
    void this.shutdown(server, force).then(() => {
      this.emit('close');
      callback?.();
    });
    return this;
  }

  /**
   * Graceful by default: let in-flight requests finish (up to `shutdownTimeout`),
   * then stop and drop every connection, including idle keep-alive ones.
   * Bun's `stop(false)` cannot be followed by `stop(true)`, so we wait first.
   * `force` skips the wait.
   */
  private async shutdown(server: Server<unknown>, force: boolean): Promise<void> {
    if (!force) {
      this.closing = true;
      const deadline = Date.now() + (this.options.shutdownTimeout ?? 10_000);
      while (server.pendingRequests > 0 && Date.now() < deadline) await Bun.sleep(5);
    }
    await server.stop(true);
  }

  /** Destroys in-flight connections (Node's `server.closeAllConnections()`). */
  closeAllConnections(): void {
    void this.bun?.stop(true);
  }

  /** Promise-friendly close used by the adapter. */
  stop(force = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.bun) return resolve();
      this.close(force, () => resolve());
    });
  }
}

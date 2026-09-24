import {
  BadRequestException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
  RequestMethod,
  StreamableFile,
  UnsupportedMediaTypeException,
  type NestApplicationOptions,
  type VersioningOptions,
} from '@nestjs/common';
import type { VersionValue } from '@nestjs/common/internal';
import { AbstractHttpAdapter } from '@nestjs/core';
import { LegacyRouteConverter, RouterMethodFactory } from '@nestjs/core/internal';
import type { Server } from 'bun';
import cors from 'cors';
import { pathToRegexp } from 'path-to-regexp';
import { createBodyParser, type BodyParserOptions, type ParserType } from './body-parser.js';
import { BunRequest } from './request.js';
import { BunResponse } from './response.js';
import { Router, type NextFunction, type RequestHandler } from './router.js';
import { BunHttpServer, type BunServeOptions } from './server.js';
import { serveStatic, type StaticOptions } from './static.js';
import { addLeadingSlash, isNil, isObject, stripEndSlash } from './utils.js';
import { applyVersionFilter } from './version-filter.js';
import { ViewRenderer, type ViewEngineOption } from './views.js';

export interface BunAdapterOptions {
  /** Options forwarded to `Bun.serve()`. */
  serve?: BunServeOptions;
  /** Trust `X-Forwarded-*` headers for `req.ip`, `req.hostname`, `req.protocol`. Default `false`. */
  trustProxy?: boolean;
  /** Default body limit for the built-in JSON/urlencoded parsers. Default `100kb`. */
  bodyLimit?: number | string;
}

type OnRequestHook = (req: BunRequest, res: BunResponse, next: NextFunction) => unknown;
type OnResponseHook = (req: BunRequest, res: BunResponse) => unknown;

/**
 * NestJS HTTP adapter running on `Bun.serve()`.
 *
 * ```ts
 * const app = await NestFactory.create(AppModule, new BunAdapter());
 * await app.listen(3000);
 * ```
 */
export class BunAdapter extends AbstractHttpAdapter<BunHttpServer, BunRequest, BunResponse> {
  private readonly logger = new Logger(BunAdapter.name);
  private readonly routerMethodFactory = new RouterMethodFactory();
  private readonly registeredPrefixes = new Set<string>();
  private readonly views = new ViewRenderer();
  private readonly adapterOptions: BunAdapterOptions;
  private parsersRegistered = false;
  private isShuttingDown = false;
  private forceCloseConnections = false;
  private return503OnClosing = false;
  private onRequestHook?: OnRequestHook;
  private onResponseHook?: OnResponseHook;

  constructor(options: BunAdapterOptions = {}) {
    super(new Router());
    this.adapterOptions = options;
    this.router.use((req: BunRequest, res: BunResponse, next: NextFunction) => {
      if (this.onResponseHook) {
        res.on('finish', () => void this.onResponseHook?.(req, res));
      }
      if (this.onRequestHook) void this.onRequestHook(req, res, next);
      else next();
    });
  }

  /** The underlying layer router (also returned by `app.getHttpAdapter().getInstance()`). */
  get router(): Router {
    return this.instance as Router;
  }

  /**
   * Run a request through the whole Nest pipeline without a listening socket.
   * Ideal for tests: `await adapter.fetch(new Request('http://localhost/users'))`.
   */
  readonly fetch = (request: Request, server?: Server<unknown> | null): Promise<Response> => {
    if (this.isShuttingDown && this.return503OnClosing) {
      return Promise.resolve(
        new Response('Service Unavailable', { status: 503, headers: { connection: 'close' } }),
      );
    }
    const req = new BunRequest(request, { server, trustProxy: this.adapterOptions.trustProxy });
    const res = new BunResponse(req);
    req.res = res;
    if (this.views.configured) res.viewRenderer = (view, data) => this.views.render(view, data);
    return this.router.handle(req, res);
  };

  // ---- Lifecycle -----------------------------------------------------------------

  override initHttpServer(options: NestApplicationOptions): void {
    const serve: BunServeOptions = { ...this.adapterOptions.serve };
    if (options?.httpsOptions) {
      const https = options.httpsOptions as Record<string, unknown>;
      serve.tls = {
        key: https.key as string,
        cert: https.cert as string,
        ca: https.ca as string,
        passphrase: https.passphrase as string,
        ...(serve.tls ?? {}),
      };
    }
    this.httpServer = new BunHttpServer(this.fetch, serve);
    this.forceCloseConnections = !!options?.forceCloseConnections;
    this.return503OnClosing = !!options?.return503OnClosing;
  }

  override listen(port: string | number, callback?: () => void): void;
  override listen(port: string | number, hostname: string, callback?: () => void): void;
  override listen(port: string | number, ...args: unknown[]): void {
    const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as (err?: Error) => void) : undefined;
    const hostname = typeof args[0] === 'string' ? args[0] : undefined;
    this.httpServer.listen(port, hostname, callback);
  }

  override beforeClose(): void {
    this.isShuttingDown = true;
  }

  override async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.httpServer?.stop(this.forceCloseConnections);
  }

  override getType(): string {
    return 'bun';
  }

  isRouteOrderSensitive(): boolean {
    return true;
  }

  override setOnRequestHook(hook: OnRequestHook): void {
    this.onRequestHook = hook;
  }

  override setOnResponseHook(hook: OnResponseHook): void {
    this.onResponseHook = hook;
  }

  // ---- Response helpers ------------------------------------------------------------

  override reply(response: BunResponse, body: unknown, statusCode?: number): unknown {
    if (!isNil(statusCode)) response.status(statusCode);
    if (isNil(body)) return response.send();

    if (body instanceof StreamableFile) {
      const headers = body.getHeaders();
      setIfMissing(response, 'Content-Type', headers.type);
      setIfMissing(response, 'Content-Disposition', headers.disposition);
      setIfMissing(response, 'Content-Length', headers.length as number | undefined);
      const stream = body.getStream();
      stream.once('error', (err) => body.errorHandler(err, response as never));
      return stream.pipe(response).on('error', (err) => body.errorLogger(err));
    }

    const contentType = response.getHeader('Content-Type');
    if (
      typeof contentType === 'string' &&
      !contentType.startsWith('application/json') &&
      (body as { statusCode?: number })?.statusCode! >= HttpStatus.BAD_REQUEST
    ) {
      this.logger.warn("Content-Type doesn't match Reply body, you might need a custom ExceptionFilter for non-JSON responses");
      response.setHeader('Content-Type', 'application/json');
    }
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) return response.send(body);
    return isObject(body) ? response.json(body) : response.send(String(body));
  }

  override status(response: BunResponse, statusCode: number): BunResponse {
    return response.status(statusCode);
  }

  override end(response: BunResponse, message?: string): void {
    response.end(message);
  }

  override render(response: BunResponse, view: string, options: object): Promise<void> {
    return this.views.render(view, options ?? {}).then((html) => {
      response.type('html').send(html);
    });
  }

  override redirect(response: BunResponse, statusCode: number, url: string): void {
    response.redirect(statusCode, url);
  }

  override isHeadersSent(response: BunResponse): boolean {
    return response.headersSent;
  }

  override getHeader(response: BunResponse, name: string): string | string[] | undefined {
    return response.getHeader(name);
  }

  override setHeader(response: BunResponse, name: string, value: string): BunResponse {
    return response.set(name, value);
  }

  override appendHeader(response: BunResponse, name: string, value: string): BunResponse {
    return response.appendHeader(name, value);
  }

  // ---- Request helpers -------------------------------------------------------------

  override getRequestHostname(request: BunRequest): string {
    return request.hostname;
  }

  override getRequestMethod(request: BunRequest): string {
    return request.method;
  }

  override getRequestUrl(request: BunRequest): string {
    return request.originalUrl;
  }

  // ---- Registration ----------------------------------------------------------------

  override normalizePath(path: string): string {
    try {
      const converted = LegacyRouteConverter.tryConvert(path);
      pathToRegexp(converted); // throws TypeError on invalid syntax
      return converted;
    } catch (e) {
      if (e instanceof TypeError) LegacyRouteConverter.printError(path);
      throw e;
    }
  }

  override createMiddlewareFactory(requestMethod: RequestMethod): (path: string, callback: Function) => unknown {
    return (path, callback) => {
      try {
        const converted = LegacyRouteConverter.tryConvert(path);
        return this.routerMethodFactory
          .get(this.router as never, requestMethod)
          .call(this.router, converted, callback as RequestHandler);
      } catch (e) {
        if (e instanceof TypeError) LegacyRouteConverter.printError(path);
        throw e;
      }
    };
  }

  override setErrorHandler(handler: Function, prefix?: string): void {
    const normalized = this.normalizePrefix(prefix);
    if (normalized) this.router.use(normalized, handler as never);
    this.router.use(handler as never);
  }

  override setNotFoundHandler(handler: Function, prefix?: string): void {
    const normalized = this.normalizePrefix(prefix);
    if (normalized) {
      this.registeredPrefixes.add(normalized);
      this.router.use(normalized, handler as RequestHandler);
      return;
    }
    this.router.use((req: BunRequest, res: BunResponse, next: NextFunction) => {
      for (const registered of this.registeredPrefixes) {
        if (req.path === registered || req.path.startsWith(`${registered}/`)) return next();
      }
      return (handler as RequestHandler)(req, res, next);
    });
  }

  override registerParserMiddleware(_prefix?: string, rawBody?: boolean): void {
    if (this.parsersRegistered) return;
    this.parsersRegistered = true;
    const limit = this.adapterOptions.bodyLimit;
    this.router.use(createBodyParser('json', { limit, rawBody }));
    this.router.use(createBodyParser('urlencoded', { limit, rawBody }));
  }

  useBodyParser(type: ParserType, rawBody?: boolean, options: BodyParserOptions = {}): this {
    this.router.use(createBodyParser(type, { limit: this.adapterOptions.bodyLimit, ...options, rawBody }));
    return this;
  }

  override enableCors(options?: Parameters<typeof cors>[0]): void {
    this.router.use(cors(options as never) as unknown as RequestHandler);
  }

  override useStaticAssets(path: string, options: StaticOptions = {}): this {
    this.router.use(serveStatic(path, options));
    return this;
  }

  override setViewEngine(engine: ViewEngineOption | string): this {
    this.views.setEngine(engine);
    return this;
  }

  setBaseViewsDir(path: string | string[]): this {
    this.views.setDirs(path);
    return this;
  }

  override applyVersionFilter(handler: Function, version: VersionValue, versioningOptions: VersioningOptions) {
    return applyVersionFilter(handler, version, versioningOptions) as never;
  }

  override mapException(error: unknown): unknown {
    if (error instanceof SyntaxError || error instanceof URIError) {
      return new BadRequestException(error.message);
    }
    const status = (error as { status?: number })?.status;
    if (status === 413) return new PayloadTooLargeException((error as Error).message);
    if (status === 415) return new UnsupportedMediaTypeException((error as Error).message);
    return error;
  }

  private normalizePrefix(prefix?: string): string {
    return prefix ? stripEndSlash(addLeadingSlash(prefix)) : '';
  }
}

function setIfMissing(res: BunResponse, name: string, value: string | string[] | number | undefined): void {
  if (value !== undefined && res.getHeader(name) === undefined) res.setHeader(name, Array.isArray(value) ? value.join(',') : String(value));
}

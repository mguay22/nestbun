import { Writable } from 'node:stream';
import type { BunFile } from 'bun';
import type { BunRequest } from './request.js';
import { isObject, lookupType, normalizeContentType, statusText } from './utils.js';

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  partitioned?: boolean;
  priority?: 'low' | 'medium' | 'high';
  encode?: (value: string) => string;
}

type HeaderValue = string | string[];
type Mode = 'idle' | 'buffered' | 'streaming';

const EMPTY_STATUSES = new Set([204, 205, 304]);

/**
 * Express-shaped response that implements the `node:stream` Writable
 * interface (Bun's native implementation of it; no Node runtime involved) and
 * resolves into a Web `Response` that `Bun.serve` sends. Nest's core pipes its
 * SSE stream and `StreamableFile` into the response with `stream.pipe()`,
 * which is why the response must speak that interface.
 *
 * Two paths:
 * - `end(body)` with no prior write → the whole body is buffered and sent as
 *   one fixed-length `Response` (the common case).
 * - `write()` / `writeHead()` / `flushHeaders()` → headers are committed and
 *   the body becomes a `ReadableStream`; every later write is enqueued. This
 *   is what SSE and `StreamableFile` use.
 */
export class BunResponse extends Writable {
  statusCode = 200;
  statusMessage = '';
  locals: Record<string, unknown> = {};
  readonly req: BunRequest;
  /** Resolves once headers are committed (streaming) or the body is complete (buffered). */
  readonly response: Promise<Response>;
  [key: string]: unknown;

  private readonly headerMap = new Map<string, { name: string; value: HeaderValue }>();
  private mode: Mode = 'idle';
  private committed = false;
  private chunks: Buffer[] = [];
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private resolveResponse!: (response: Response) => void;
  private fileBody: BunFile | null = null;

  constructor(req: BunRequest) {
    super({ decodeStrings: true });
    this.req = req;
    this.response = new Promise((resolve) => {
      this.resolveResponse = resolve;
    });
  }

  /** Watching `'close'` means the caller cares about disconnects, so start propagating aborts. */
  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'close') this.req.watchAbort();
    return super.on(event, listener);
  }

  override once(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'close') this.req.watchAbort();
    return super.once(event, listener);
  }

  // ---- Node ServerResponse surface -----------------------------------------

  get headersSent(): boolean {
    return this.committed;
  }

  /** Node's deprecated alias, still read by some middleware. */
  get finished(): boolean {
    return this.writableFinished;
  }

  setHeader(name: string, value: HeaderValue | number): this {
    this.assertHeadersNotSent();
    const key = name.toLowerCase();
    this.headerMap.set(key, { name, value: Array.isArray(value) ? value.map(String) : String(value) });
    return this;
  }

  getHeader(name: string): HeaderValue | undefined {
    return this.headerMap.get(name.toLowerCase())?.value;
  }

  getHeaders(): Record<string, HeaderValue> {
    const out: Record<string, HeaderValue> = {};
    for (const [key, { value }] of this.headerMap) out[key] = value;
    return out;
  }

  getHeaderNames(): string[] {
    return [...this.headerMap.keys()];
  }

  hasHeader(name: string): boolean {
    return this.headerMap.has(name.toLowerCase());
  }

  removeHeader(name: string): void {
    this.assertHeadersNotSent();
    this.headerMap.delete(name.toLowerCase());
  }

  appendHeader(name: string, value: HeaderValue): this {
    this.assertHeadersNotSent();
    const key = name.toLowerCase();
    const existing = this.headerMap.get(key);
    const incoming = Array.isArray(value) ? value : [value];
    if (!existing) {
      this.headerMap.set(key, { name, value: incoming.length === 1 ? incoming[0]! : incoming });
    } else {
      const current = Array.isArray(existing.value) ? existing.value : [existing.value];
      existing.value = [...current, ...incoming];
    }
    return this;
  }

  writeHead(statusCode: number, statusMessage?: string | Record<string, HeaderValue>, headers?: Record<string, HeaderValue>): this {
    if (typeof statusMessage === 'object') {
      headers = statusMessage;
      statusMessage = undefined;
    }
    this.statusCode = statusCode;
    if (statusMessage) this.statusMessage = statusMessage;
    if (headers) for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    this.flushHeaders();
    return this;
  }

  /** Commit headers now and switch to streaming mode. */
  flushHeaders(): void {
    if (this.committed) return;
    this.mode = 'streaming';
    this.req.watchAbort(); // a streaming producer must stop when the client goes away
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.controller = null;
        this.req.markAborted();
        if (!this.destroyed) this.destroy();
      },
    });
    this.commit(this.isBodyless() ? null : stream);
  }

  // ---- Writable internals -----------------------------------------------------

  override write(chunk: any, encoding?: any, cb?: any): boolean {
    if (this.mode === 'idle') this.flushHeaders();
    return super.write(chunk, encoding, cb);
  }

  override end(chunk?: any, encoding?: any, cb?: any): this {
    if (this.mode === 'idle') this.mode = 'buffered';
    return super.end(chunk, encoding, cb);
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (this.mode === 'buffered') {
      this.chunks.push(chunk);
    } else if (this.controller) {
      try {
        this.controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      } catch (error) {
        return callback(error as Error);
      }
    }
    callback();
  }

  override _final(callback: (error?: Error | null) => void): void {
    if (this.mode === 'streaming') {
      try {
        this.controller?.close();
      } catch {
        // stream already cancelled by the client
      }
      this.controller = null;
    } else {
      const body = this.fileBody ?? (this.chunks.length === 1 ? this.chunks[0]! : Buffer.concat(this.chunks));
      this.chunks = [];
      this.commit(this.isBodyless() ? null : (body as unknown as BodyInit), body);
    }
    callback();
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    if (this.controller) {
      try {
        error ? this.controller.error(error) : this.controller.close();
      } catch {
        // already closed
      }
      this.controller = null;
    }
    if (!this.committed) {
      // Client went away before anything was sent; release the pending fetch.
      this.commit(null);
    }
    callback(error);
  }

  private commit(body: BodyInit | null, bufferedBody?: Buffer | BunFile): void {
    if (this.committed) return;
    this.committed = true;
    const headers = new Headers();
    for (const { name, value } of this.headerMap.values()) {
      if (Array.isArray(value)) for (const v of value) headers.append(name, v);
      else headers.set(name, value);
    }
    if (this.req.method === 'HEAD' && bufferedBody && !headers.has('content-length')) {
      const size = 'size' in bufferedBody ? bufferedBody.size : bufferedBody.byteLength;
      headers.set('content-length', String(size));
    }
    this.resolveResponse(
      new Response(body, { status: this.statusCode, statusText: this.statusMessage || undefined, headers }),
    );
  }

  private isBodyless(): boolean {
    return this.req.method === 'HEAD' || EMPTY_STATUSES.has(this.statusCode);
  }

  private assertHeadersNotSent(): void {
    if (this.committed) {
      const err = new Error('Cannot set headers after they are sent to the client');
      (err as Error & { code: string }).code = 'ERR_HTTP_HEADERS_SENT';
      throw err;
    }
  }

  // ---- Express surface ----------------------------------------------------------

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  sendStatus(code: number): this {
    this.statusCode = code;
    this.type('txt');
    return this.send(statusText(code));
  }

  /** Express `res.set()`: like `setHeader`, but adds `charset=utf-8` to text-like Content-Types. */
  set(field: string | Record<string, HeaderValue | number>, value?: HeaderValue | number): this {
    if (typeof field === 'object') {
      for (const [name, v] of Object.entries(field)) this.set(name, v);
      return this;
    }
    if (field.toLowerCase() === 'content-type' && typeof value === 'string') {
      return this.setHeader(field, normalizeContentType(value));
    }
    return this.setHeader(field, value ?? '');
  }

  header(field: string | Record<string, HeaderValue | number>, value?: HeaderValue | number): this {
    return this.set(field, value);
  }

  get(field: string): HeaderValue | undefined {
    return this.getHeader(field);
  }

  append(field: string, value: HeaderValue): this {
    return this.appendHeader(field, value);
  }

  type(type: string): this {
    return this.set('Content-Type', lookupType(type));
  }

  contentType(type: string): this {
    return this.type(type);
  }

  vary(field: string): this {
    const current = this.getHeader('Vary');
    if (!current) return this.setHeader('Vary', field);
    const list = String(current).split(',').map((s) => s.trim().toLowerCase());
    if (list.includes('*') || list.includes(field.toLowerCase())) return this;
    return this.setHeader('Vary', `${current}, ${field}`);
  }

  location(url: string): this {
    return this.setHeader('Location', encodeUrl(url));
  }

  redirect(url: string): void;
  redirect(status: number, url: string): void;
  redirect(statusOrUrl: number | string, maybeUrl?: string): void {
    const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
    const url = typeof statusOrUrl === 'number' ? (maybeUrl ?? '/') : statusOrUrl;
    this.location(url);
    this.statusCode = status;
    this.type('txt');
    this.send(`${statusText(status)}. Redirecting to ${url}`);
  }

  json(body: unknown): this {
    if (!this.hasHeader('Content-Type')) this.set('Content-Type', 'application/json');
    return this.send(JSON.stringify(body));
  }

  jsonp(body: unknown): this {
    return this.json(body);
  }

  send(body?: unknown): this {
    if (body === undefined || body === null) {
      this.end();
      return this;
    }
    if (typeof body === 'string') {
      if (!this.hasHeader('Content-Type')) this.set('Content-Type', 'text/html');
      this.end(body);
      return this;
    }
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      if (!this.hasHeader('Content-Type')) this.setHeader('Content-Type', 'application/octet-stream');
      this.end(Buffer.isBuffer(body) ? body : Buffer.from(body));
      return this;
    }
    if (isObject(body) || typeof body === 'number' || typeof body === 'boolean') {
      return this.json(body);
    }
    this.end(String(body));
    return this;
  }

  /** Zero-copy send of a `Bun.file()`; sets Content-Type/Length from the file. */
  sendBunFile(file: BunFile): this {
    if (!this.hasHeader('Content-Type') && file.type) this.setHeader('Content-Type', file.type);
    if (!this.hasHeader('Content-Length')) this.setHeader('Content-Length', String(file.size));
    this.fileBody = file;
    this.end();
    return this;
  }

  /** Express `res.sendFile(absolutePath)`; the path must be absolute. */
  async sendFile(path: string, options: { headers?: Record<string, string> } = {}, callback?: (err?: Error) => void): Promise<void> {
    try {
      const file = Bun.file(path);
      if (!(await file.exists())) throw Object.assign(new Error(`ENOENT: no such file '${path}'`), { status: 404, code: 'ENOENT' });
      if (options.headers) this.set(options.headers);
      this.sendBunFile(file);
      callback?.();
    } catch (error) {
      if (callback) callback(error as Error);
      else throw error;
    }
  }

  cookie(name: string, value: string | object, options: CookieOptions = {}): this {
    const val = typeof value === 'object' ? `j:${JSON.stringify(value)}` : String(value);
    const opts = { ...options };
    if (opts.maxAge !== undefined && opts.expires === undefined) {
      opts.expires = new Date(Date.now() + opts.maxAge);
      opts.maxAge = Math.floor(opts.maxAge / 1000);
    }
    return this.appendHeader('Set-Cookie', serializeCookie(name, val, opts));
  }

  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, '', { path: '/', ...options, expires: new Date(1), maxAge: undefined });
  }

  /** Attaches a `render` implementation; installed by the adapter when a view engine is set. */
  render(view: string, options?: object, callback?: (err: Error | null, html?: string) => void): void {
    const renderer = this.viewRenderer;
    if (!renderer) {
      const err = new Error('No view engine configured. Call app.setViewEngine() first.');
      if (callback) return callback(err);
      throw err;
    }
    void renderer(view, options ?? {}).then(
      (html) => {
        if (callback) return callback(null, html);
        this.type('html').send(html);
      },
      (err) => {
        if (callback) return callback(err);
        this.emit('error', err);
      },
    );
  }

  /** @internal set by the adapter */
  viewRenderer?: (view: string, options: object) => Promise<string>;
}

function encodeUrl(url: string): string {
  return url.replace(/[^\x21-\x7E]|[<>"`{}|\\^]/g, (c) => encodeURIComponent(c));
}

function serializeCookie(name: string, value: string, o: CookieOptions): string {
  const encode = o.encode ?? encodeURIComponent;
  let str = `${name}=${encode(value)}`;
  if (o.maxAge !== undefined) str += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.domain) str += `; Domain=${o.domain}`;
  str += `; Path=${o.path ?? '/'}`;
  if (o.expires) str += `; Expires=${o.expires.toUTCString()}`;
  if (o.httpOnly) str += '; HttpOnly';
  if (o.secure) str += '; Secure';
  if (o.partitioned) str += '; Partitioned';
  if (o.priority) str += `; Priority=${o.priority[0]!.toUpperCase()}${o.priority.slice(1)}`;
  if (o.sameSite) {
    const v = o.sameSite === true ? 'Strict' : o.sameSite[0]!.toUpperCase() + o.sameSite.slice(1);
    str += `; SameSite=${v}`;
  }
  return str;
}

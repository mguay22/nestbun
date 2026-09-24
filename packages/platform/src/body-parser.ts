import { HttpError, parseFailed } from './errors.js';
import { hasBody, mime, typeMatches, type BunRequest } from './request.js';
import type { RequestHandler } from './router.js';
import { parseBytes, parseQuery } from './utils.js';

export type ParserType = 'json' | 'urlencoded' | 'text' | 'raw';

export interface BodyParserOptions {
  /** Max body size, e.g. `'100kb'` or bytes. Default `100kb` (Express parity). */
  limit?: number | string;
  /** Content types to parse; defaults depend on the parser. */
  type?: string | string[] | ((req: BunRequest) => boolean);
  /** Expose the unparsed bytes as `req.rawBody` (Nest's `rawBody: true`). */
  rawBody?: boolean;
  /** JSON only: accept only objects and arrays at the top level. Default `true`. */
  strict?: boolean;
  /** Text only: default charset when the request has none. Default `utf-8`. */
  defaultCharset?: string;
}

const DEFAULT_TYPES: Record<ParserType, string[]> = {
  json: ['application/json', '+json'],
  urlencoded: ['application/x-www-form-urlencoded'],
  text: ['text/plain'],
  raw: ['application/octet-stream'],
};

const DEFAULT_LIMIT = 100 * 1024;

export function createBodyParser(kind: ParserType, options: BodyParserOptions = {}): RequestHandler {
  const limit = parseBytes(options.limit, DEFAULT_LIMIT);
  const matches = typeMatcher(options.type ?? DEFAULT_TYPES[kind]);
  const strict = options.strict ?? true;

  const parser: RequestHandler = async (req, _res, next) => {
    if (req.body !== undefined || !hasBody(req) || req.bodyUsed || !matches(req)) return next();
    try {
      const bytes = await readBody(req, limit);
      if (options.rawBody) req.rawBody = Buffer.from(bytes);
      req.body = decode(kind, bytes, req, strict, options.defaultCharset);
      next();
    } catch (error) {
      next(error);
    }
  };
  Object.defineProperty(parser, 'name', { value: `${kind}Parser` });
  return parser;
}

function decode(kind: ParserType, bytes: Uint8Array, req: BunRequest, strict: boolean, defaultCharset?: string): unknown {
  if (kind === 'raw') return Buffer.from(bytes);
  const charset = charsetOf(req.headers['content-type']) ?? defaultCharset ?? 'utf-8';
  let text: string;
  try {
    text = new TextDecoder(charset, { fatal: kind !== 'text' }).decode(bytes);
  } catch {
    throw new HttpError(415, `unsupported charset "${charset.toUpperCase()}"`, 'charset.unsupported');
  }
  switch (kind) {
    case 'text':
      return text;
    case 'urlencoded':
      return parseQuery(text);
    case 'json': {
      if (text.length === 0) return {};
      if (strict) {
        const first = text.trimStart()[0];
        if (first !== '{' && first !== '[') {
          throw parseFailed(new SyntaxError(`Unexpected token '${first ?? ''}', "${text.slice(0, 20)}" is not valid JSON`));
        }
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        throw parseFailed(error);
      }
    }
  }
}

/**
 * Reads the body up to `limit` bytes. With a `Content-Length` we use Bun's
 * fast `arrayBuffer()` path; chunked bodies stream through a reader so we
 * can abort as soon as the limit is exceeded.
 */
export async function readBody(req: BunRequest, limit: number): Promise<Uint8Array> {
  const declared = req.headers['content-length'];
  if (declared !== undefined) {
    if (Number(declared) > limit) throw new HttpError(413, 'request entity too large', 'entity.too.large');
    const buf = new Uint8Array(await req.native.arrayBuffer());
    if (buf.byteLength > limit) throw new HttpError(413, 'request entity too large', 'entity.too.large');
    return buf;
  }
  const body = req.native.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, 'request entity too large', 'entity.too.large');
    }
    chunks.push(value);
  }
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function typeMatcher(type: string | string[] | ((req: BunRequest) => boolean)): (req: BunRequest) => boolean {
  if (typeof type === 'function') return type;
  const types = Array.isArray(type) ? type : [type];
  return (req) => {
    const actual = mime(req.headers['content-type']);
    return !!actual && types.some((t) => typeMatches(actual, t));
  };
}

function charsetOf(contentType: string | undefined): string | undefined {
  const m = /;\s*charset=("?)([^";]+)\1/i.exec(contentType ?? '');
  return m?.[2]?.toLowerCase();
}

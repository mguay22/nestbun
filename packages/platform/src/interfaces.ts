import type { INestApplication } from '@nestjs/common';
import type { BunAdapter } from './adapter.js';
import type { BodyParserOptions, ParserType } from './body-parser.js';
import type { StaticOptions } from './static.js';
import type { ViewEngineOption } from './views.js';

/**
 * `INestApplication` plus the Bun-platform methods, mirroring `NestExpressApplication`.
 *
 * ```ts
 * const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
 * ```
 */
export interface NestBunApplication extends INestApplication {
  getHttpAdapter(): BunAdapter;
  useStaticAssets(path: string, options?: StaticOptions): this;
  setBaseViewsDir(path: string | string[]): this;
  setViewEngine(engine: ViewEngineOption): this;
  /** Register an extra body parser; `rawBody` is taken from the application options. */
  useBodyParser(type: ParserType, options?: BodyParserOptions): this;
}

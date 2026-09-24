import 'reflect-metadata';
import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type NestBunApplication } from '@nestbun/platform';
import { AppModule } from './app.module.js';

// Runs directly on Bun.serve() — no Express, no node:http.
const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());

// NestJS 12 validates any Standard Schema (Zod, Valibot, ArkType) attached via
// @Body({ schema }), @Query({ schema }) or @Param('id', { schema }).
app.useGlobalPipes(new StandardSchemaValidationPipe());
app.enableShutdownHooks();

await app.listen(Number(process.env.PORT ?? 3000));
new Logger('Bootstrap').log(`Listening on ${await app.getUrl()}`);

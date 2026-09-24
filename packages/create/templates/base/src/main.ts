import 'reflect-metadata';
import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);

// NestJS 12 validates any Standard Schema (Zod, Valibot, ArkType) attached via
// @Body({ schema }), @Query({ schema }) or @Param('id', { schema }).
app.useGlobalPipes(new StandardSchemaValidationPipe());
app.enableShutdownHooks();

await app.listen(Number(process.env.PORT ?? 3000));
new Logger('Bootstrap').log(`Listening on ${await app.getUrl()}`);

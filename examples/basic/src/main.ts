import 'reflect-metadata';
import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type NestBunApplication } from '@nestbun/platform';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
app.useGlobalPipes(new StandardSchemaValidationPipe());
app.enableCors();
app.enableShutdownHooks();

const port = Number(process.env.PORT ?? 3000);
await app.listen(port);
new Logger('Bootstrap').log(`Nest on Bun.serve → ${await app.getUrl()}`);

import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller.js';

@Module({ controllers: [CatsController] })
export class AppModule {}

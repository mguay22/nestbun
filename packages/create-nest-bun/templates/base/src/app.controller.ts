import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service.js';
import { greetSchema, type GreetDto } from './app.schemas.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Example of Zod validation via NestJS 12's native Standard Schema support. */
  @Post('greet')
  greet(@Body({ schema: greetSchema }) dto: GreetDto): { message: string } {
    return { message: this.appService.greet(dto.name) };
  }
}

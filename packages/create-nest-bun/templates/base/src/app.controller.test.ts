import { beforeEach, describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get(AppController);
  });

  it('returns "Hello World!"', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });
});

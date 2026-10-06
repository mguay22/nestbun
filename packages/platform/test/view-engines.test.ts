import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module, Render } from '@nestjs/common';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ViewEngineOption } from '../src/index.js';
import { bootstrap, type TestApp } from './helpers.js';

@Controller()
class PageController {
  @Get()
  @Render('index')
  index() {
    return { name: 'Tom' };
  }
  @Get('missing')
  @Render('nope')
  missing() {
    return {};
  }
}
@Module({ controllers: [PageController] })
class PageModule {}

let views: string;
beforeAll(async () => {
  views = await mkdtemp(join(tmpdir(), 'nestbun-views-'));
  await writeFile(join(views, 'index.ejs'), '<h1>Hello <%= name %></h1>');
  await writeFile(join(views, 'index.hbs'), '<h1>Hello {{name}}</h1>');
  await writeFile(join(views, 'index.pug'), 'h1 Hello #{name}');
  await writeFile(join(views, 'index.txt'), 'Hello NAME');
});

const custom: ViewEngineOption = {
  extension: 'txt',
  async render(file, data) {
    return (await Bun.file(file).text()).replace('NAME', (data as { name: string }).name);
  },
};

for (const [label, engine] of [
  ['ejs', 'ejs'],
  ['hbs', 'hbs'],
  ['pug', 'pug'],
  ['custom render()', custom],
] as const) {
  describe(`view engine: ${label}`, () => {
    let t: TestApp;
    beforeAll(async () => {
      t = await bootstrap(PageModule, {
        configure: (app) => {
          app.setBaseViewsDir(views);
          app.setViewEngine(engine);
        },
      });
    });
    afterAll(() => t.close());

    it('renders @Render() templates as HTML', async () => {
      const r = await t.fetch('/');
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await r.text()).toBe(label === 'custom render()' ? 'Hello Tom' : '<h1>Hello Tom</h1>');
    });

    it('answers 500 when the view does not exist', async () => {
      expect((await t.fetch('/missing')).status).toBe(500);
    });
  });
}

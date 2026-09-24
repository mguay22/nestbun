import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { bootstrap, type TestApp } from './helpers.js';

@ApiTags('pets')
@Controller('pets')
class PetsController {
  @Get()
  list() {
    return [];
  }
}
@Module({ controllers: [PetsController] })
class PetsModule {}

describe('@nestjs/swagger', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(PetsModule, {
      configure: (app) => {
        const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Pets').setVersion('1').build());
        SwaggerModule.setup('docs', app, doc);
      },
    });
  });
  afterAll(() => t.close());

  it('serves the UI, the JSON and YAML documents, and the static assets', async () => {
    const ui = await t.fetch('/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers.get('content-type')).toContain('text/html');
    expect(await ui.text()).toContain('swagger-ui');

    const json = await t.json('/docs-json');
    expect(json.status).toBe(200);
    expect(json.body.info.title).toBe('Pets');
    expect(Object.keys(json.body.paths)).toContain('/pets');

    const yaml = await t.fetch('/docs-yaml');
    expect(yaml.status).toBe(200);
    expect(await yaml.text()).toContain('title: Pets');

    for (const asset of ['/docs/swagger-ui-bundle.js', '/docs/swagger-ui.css', '/docs/swagger-ui-init.js']) {
      const r = await t.fetch(asset);
      expect(r.status).toBe(200);
      expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);
    }
  });
});

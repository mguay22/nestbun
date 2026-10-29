/**
 * Boots one benchmark target in its own process and prints its base URL.
 *
 *   bun server.ts <raw-bun|router-only|nest-express|nest-fastify|nest-node|nest-bun>
 */
import 'reflect-metadata';
import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, BunRequest, BunResponse, Router } from '@nestbun/platform';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { NodeAdapter } from '@nestjs/platform-node';

@Controller('users')
class UsersController {
  @Get(':id')
  one(@Param('id') id: string) {
    return { id, name: 'Ada', email: 'ada@example.com', roles: ['admin', 'dev'] };
  }
  @Post()
  create(@Body() body: unknown) {
    return { created: body };
  }
}
@Module({ controllers: [UsersController] })
class AppModule {}

const adapters: Record<string, () => any> = {
  express: () => new ExpressAdapter(),
  fastify: () => new FastifyAdapter(),
  node: () => new NodeAdapter(),
  bun: () => new BunAdapter(),
};

const target = process.argv[2] ?? '';

if (target === 'raw-bun') {
  // What the runtime itself can do.
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: async (req) =>
      req.method === 'POST'
        ? Response.json({ created: await req.json() }, { status: 201 })
        : Response.json({
            id: '42',
            name: 'Ada',
            email: 'ada@example.com',
            roles: ['admin', 'dev'],
          }),
  });
  console.log(server.url.origin);
} else if (target === 'router-only') {
  // What our router costs without Nest.
  const router = new Router();
  router.use(async (req, _res, next) => {
    if (req.method === 'POST') req.body = await req.native.json();
    next();
  });
  router.get('/users/:id', (req, res) =>
    res.json({ id: req.params.id, name: 'Ada', email: 'ada@example.com', roles: ['admin', 'dev'] }),
  );
  router.post('/users', (req, res) => res.status(201).json({ created: req.body }));
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: (request, bunServer) => {
      const req = new BunRequest(request, { server: bunServer });
      const res = new BunResponse(req);
      return router.handle(req, res);
    },
  });
  console.log(server.url.origin);
} else if (target.startsWith('nest-') && adapters[target.slice(5)]) {
  const app = await NestFactory.create(AppModule, adapters[target.slice(5)]!(), { logger: false });
  await app.listen(0, '127.0.0.1');
  console.log((await app.getUrl()).replace('[::1]', '127.0.0.1'));
} else {
  console.error(`unknown target: ${target}`);
  process.exit(1);
}

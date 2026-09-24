# Project conventions

- NestJS 12 on the Bun runtime. Run with `bun dev`, test with `bun test`, type-check with `bun run typecheck`. There is no build step and no `nest build`.
- ESM only: `"type": "module"`, `NodeNext` resolution, `.js` extensions on relative imports.
- Validation: Zod schemas in `*.schemas.ts`, applied with `@Body({ schema })` / `@Query({ schema })` / `@Param('id', { schema })`. No `class-validator`, no `class-transformer`, no `nestjs-zod`.
- Controllers only route, validate and delegate. Business logic lives in `@Injectable()` services.
- Tests use `bun:test`. E2E tests boot the app with `app.listen(0)` and use `fetch`.

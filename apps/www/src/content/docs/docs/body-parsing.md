---
title: Body parsing
description: Default parsers, limits, raw bodies, and adding text or binary parsers.
---

## Defaults

JSON (`application/json` and `+json` types) and urlencoded bodies are parsed automatically, with a `100kb` limit, exactly like `@nestjs/platform-express`. Requests without a body, or with an unrecognized `Content-Type`, leave `req.body` undefined.

- Invalid JSON → `400 Bad Request` with the parser message.
- Top-level primitives (`"str"`, `42`) are rejected in strict mode, like body-parser.
- Bodies over the limit → `413 Payload Too Large`.
- Unsupported charsets → `415`.

Raise the limit for the whole app:

```ts
new BunAdapter({ bodyLimit: '5mb' });
```

## Raw body

Webhook signatures need the exact bytes:

```ts
const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter(), { rawBody: true });
```

```ts
@Post('stripe')
webhook(@RawBody() raw: Buffer, @Headers('stripe-signature') sig: string) { ... }
```

## More parsers

```ts
app.useBodyParser('text');                       // text/plain → string
app.useBodyParser('raw', { type: 'image/*' });   // → Buffer
app.useBodyParser('json', { limit: '10mb', type: 'application/vnd.custom+json' });
```

Parsers run in registration order and each one only handles requests whose `Content-Type` matches its `type`.

## Turning parsing off

```ts
NestFactory.create(AppModule, new BunAdapter(), { bodyParser: false });
```

Then read the body yourself from the Web `Request`:

```ts
@Post('upload')
async upload(@Req() req: BunRequest) {
  const form = await req.native.formData();
  const file = form.get('file') as File;
}
```

`req.native` is the underlying Web `Request`. Its `json()`, `text()`, `arrayBuffer()` and `formData()` are all available as long as no parser consumed the body first.

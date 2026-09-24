---
title: Static files and views
description: Serve a directory with Bun.file() and render templates with ejs, hbs, pug or your own engine.
---

## Static assets

```ts
app.useStaticAssets('public', { prefix: '/static', maxAge: '1d' });
```

Files are served with `Bun.file()` (zero-copy), with `Content-Type` inferred from the extension, a weak `ETag`, `Last-Modified`, and `304` responses for `If-None-Match` / `If-Modified-Since`.

| Option | Default | |
|---|---|---|
| `prefix` | `/` | URL path the directory is mounted under |
| `index` | `index.html` | Directory index file, or `false` |
| `maxAge` | | `Cache-Control: max-age`, in milliseconds or `'1d'`-style strings |
| `immutable` | `false` | Add `immutable` to `Cache-Control` |
| `dotfiles` | `ignore` | `allow`, `deny` (403) or `ignore` (404) |
| `redirect` | `true` | Redirect `/dir` to `/dir/` |
| `fallthrough` | `true` | Call `next()` for misses so Nest's 404 answers; `false` sends 404 directly |
| `setHeaders` | | `(res, path) => void` for extra headers |

Path traversal (`..`) and null bytes are rejected before touching the filesystem.

## View engines

```ts
app.setBaseViewsDir('views');
app.setViewEngine('ejs'); // or 'hbs' | 'handlebars' | 'pug'
```

```ts
@Get()
@Render('home')
home() {
  return { title: 'Hello' };
}
```

Install the engine you pick (`bun add ejs`). The extension is appended automatically (`home` → `views/home.ejs`).

### Custom engine

Any object with a `render(file, data)` method works, so you can plug in Eta, Nunjucks, or a function that renders JSX to a string:

```ts
app.setViewEngine({
  extension: 'eta',
  render: (file, data) => eta.renderFile(file, data),
});
```

`res.render(view, data)` is also available on `@Res()` handlers.

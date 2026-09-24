# Releasing

## One-time setup

1. **npm org for the scope.** Sign in at npmjs.com → profile menu → *Add Organization* → name `nestbun` (free, public packages). If the name is taken, rename the package to unscoped `nestbun` in `packages/platform/package.json` and skip this step.
2. **npm token for CI.** npmjs.com → *Access Tokens* → *Generate New Token* → *Granular Access Token*, packages & scopes: read and write on `@nestbun`, no IP allowlist needed. Copy it.
3. **GitHub secret.** `gh secret set NPM_TOKEN --repo mguay22/nestbun` and paste the token.
4. **GitHub Pages.** Repo → Settings → Pages → *Source: GitHub Actions*. The landing page then deploys on every push that touches `apps/www/`.

## First publish (from your machine, so you own the package)

```bash
npm login                                   # once
cd packages/platform
bun run build && bun test
bun publish --access public                 # creates @nestbun/platform on npm
```

## Every release after that

```bash
# bump the version in whichever packages changed (packages/platform, packages/create-nest-bun), commit, then:
git tag v0.1.1
git push origin main --tags
```

`release.yml` runs the tests, builds every package, and publishes each one whose version is not on npm yet (`scripts/publish.ts`), then drafts a GitHub release.

## The starter template

`packages/create-nest-bun/templates/base` is the project `bun create nest-bun` generates; edit it directly. Bump `PLATFORM_VERSION` in `packages/create-nest-bun/src/scaffold.ts` when `@nestbun/platform` gets a new minor, and bump `create-nest-bun`'s own version so the release workflow publishes it.

## Verify

```bash
bunx npm view @nestbun/platform version
mkdir /tmp/smoke && cd /tmp/smoke && bun init -y && bun add @nestbun/platform @nestjs/common @nestjs/core reflect-metadata rxjs
```

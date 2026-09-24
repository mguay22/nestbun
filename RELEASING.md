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
# bump version in packages/platform/package.json, commit, then:
git tag v0.1.1
git push origin main --tags                 # release.yml tests, builds, publishes, drafts a GitHub release
```

## Verify

```bash
bunx npm view @nestbun/platform version
mkdir /tmp/smoke && cd /tmp/smoke && bun init -y && bun add @nestbun/platform @nestjs/common @nestjs/core reflect-metadata rxjs
```

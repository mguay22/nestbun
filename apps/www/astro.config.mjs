// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Deployed to GitHub Pages at https://mguay22.github.io/nestbun/
// Set SITE_URL / SITE_BASE to move it (e.g. SITE_URL=https://nestbun.dev SITE_BASE=/).
const site = process.env.SITE_URL ?? 'https://mguay22.github.io';
const base = process.env.SITE_BASE ?? '/nestbun';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'nestbun',
      description:
        'nestbun is a NestJS adapter for Bun: run your Nest app natively on Bun.serve(), faster than Express and Fastify, with a one-line change.',
      logo: { src: './src/assets/logo.svg', alt: 'nestbun' },
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${site}${base}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'nestbun' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}${base}/og.png` } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#17181c' } },
        {
          tag: 'meta',
          attrs: { name: 'keywords', content: 'nestjs bun, nestjs bun adapter, run nestjs on bun, bun.serve nestjs, nestjs bun runtime' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: { SocialIcons: './src/components/SocialIcons.astro' },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mguay22/nestbun' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/@nestbun/platform' },
      ],
      editLink: { baseUrl: 'https://github.com/mguay22/nestbun/edit/main/apps/www/' },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Getting started', slug: 'docs/getting-started' },
            { label: 'Migrating from Express', slug: 'docs/migrating-from-express' },
            { label: 'Configuration', slug: 'docs/configuration' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Testing without a port', slug: 'docs/testing' },
            { label: 'Streaming and SSE', slug: 'docs/streaming-and-sse' },
            { label: 'Static files and views', slug: 'docs/static-files-and-views' },
            { label: 'Body parsing', slug: 'docs/body-parsing' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Differences from Express', slug: 'docs/differences-from-express' },
            { label: 'How it works', slug: 'docs/how-it-works' },
            { label: 'Benchmarks', slug: 'docs/benchmarks' },
            { label: 'Compatibility', slug: 'docs/compatibility' },
            { label: 'Roadmap', slug: 'docs/roadmap' },
          ],
        },
      ],
    }),
  ],
});

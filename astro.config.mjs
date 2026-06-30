import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://momentdart.be',
  base: '/',
  output: 'static',
  integrations: [sitemap()],
});

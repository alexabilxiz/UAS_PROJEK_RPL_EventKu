import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swaggerDistDir = path.join(rootDir, 'backend', 'node_modules', 'swagger-ui-dist');
const openApiSource = path.join(rootDir, 'docs', 'openapi.yaml');
const targetDir = path.join(rootDir, 'frontend', 'dist', 'api-docs');

const distFiles = [
  'index.css',
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-32x32.png',
  'favicon-16x16.png',
];

if (!existsSync(swaggerDistDir)) {
  throw new Error(`swagger-ui-dist tidak ditemukan di ${swaggerDistDir}. Jalankan npm --prefix backend ci terlebih dahulu.`);
}
if (!existsSync(openApiSource)) {
  throw new Error(`Spesifikasi OpenAPI tidak ditemukan di ${openApiSource}.`);
}

mkdirSync(targetDir, { recursive: true });

for (const file of distFiles) {
  copyFileSync(path.join(swaggerDistDir, file), path.join(targetDir, file));
}
copyFileSync(openApiSource, path.join(targetDir, 'openapi.yaml'));

const swaggerInitJs = `window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    url: '/api-docs/openapi.yaml',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: true,
    validatorUrl: null,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset,
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl,
    ],
    layout: 'StandaloneLayout',
  });
});
`;

const indexHtml = `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EventKu API — Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="/api-docs/swagger-ui.css" />
    <link rel="stylesheet" type="text/css" href="/api-docs/index.css" />
    <link rel="icon" type="image/png" href="/api-docs/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="/api-docs/favicon-16x16.png" sizes="16x16" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api-docs/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="/api-docs/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script src="/api-docs/swagger-init.js" charset="UTF-8"></script>
  </body>
</html>
`;

writeFileSync(path.join(targetDir, 'swagger-init.js'), swaggerInitJs, 'utf8');
writeFileSync(path.join(targetDir, 'index.html'), indexHtml, 'utf8');

console.log(`Swagger UI static assets siap di ${path.relative(rootDir, targetDir)}`);

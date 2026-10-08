// RefTech Technology Company - CONFIDENTIAL.
// `npm run package`: builds the portal and packs dist/ into reftech-portal-<version>.tar.gz (version from package.json).
// Works on Linux, macOS and Windows 10+ (all have `tar`). Install it on the server with deploy/install.sh.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!existsSync('dist/index.html')) {
  console.error('dist/index.html is missing: run `npm run build` first.');
  process.exit(1);
}
const archive = `reftech-portal-${version}.tar.gz`;
execFileSync('tar', ['-czf', archive, '-C', 'dist', '.'], { stdio: 'inherit' });
console.log(`Created ${archive}. Copy it to the server and run: sudo deploy/install.sh ${archive}`);

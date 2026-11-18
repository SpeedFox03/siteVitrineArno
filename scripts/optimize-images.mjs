import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';

const publicRoot = resolve('public');
const output = join(publicRoot, 'images/optimized');
await mkdir(output, { recursive: true });
const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(join(directory, entry.name))
    : /\.(jpe?g|png)$/i.test(entry.name) ? [join(directory, entry.name)] : []))).flat();
};
const files = [join(publicRoot, 'logo.png'), ...(await Promise.all(
  ['avant-apres', 'projets-photo', 'motifs-deco', 'a-propos'].map((directory) => walk(join(publicRoot, 'images', directory))),
)).flat()].sort();
const variants = {};
let generated = 0;
for (const file of files) {
  const input = await readFile(file);
  const metadata = await sharp(input).rotate().metadata();
  const portraitRotation = [5, 6, 7, 8].includes(metadata.orientation);
  const width = portraitRotation ? metadata.height : metadata.width;
  const height = portraitRotation ? metadata.width : metadata.height;
  const isLogo = file === join(publicRoot, 'logo.png');
  const widths = [...new Set((isLogo ? [96, 192] : [320, 640, 1000]).map((size) => Math.min(size, width)))];
  const hash = createHash('sha256').update(input).update('webp-80-v1').digest('hex').slice(0, 16);
  const images = [];
  for (const size of widths) {
    const name = `${hash}-${size}.webp`;
    const destination = join(output, name);
    try { await access(destination); } catch {
      await sharp(input).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: isLogo ? 90 : 80 }).toFile(destination);
      generated++;
    }
    images.push({ width: size, src: `/images/optimized/${name}` });
  }
  variants['/' + relative(publicRoot, file).split(sep).join('/')] = { width, height, images };
}
const manifest = JSON.stringify(variants, null, 2) + '\n';
const manifestPath = resolve('src/data/image-variants.json');
let previous;
try { previous = await readFile(manifestPath, 'utf8'); } catch {}
if (previous !== manifest) await writeFile(manifestPath, manifest);
console.log(`Images: ${files.length} originals, ${generated} WebP variants generated (originals preserved).`);

import manifest from '../data/image-variants.json';

type ImageVariants = { width: number; height: number; images: { width: number; src: string }[] };
const images: Record<string, ImageVariants> = manifest;

// Paths remain rooted at BASE_URL, including when the site is served in a subdirectory.
export const imageProps = (source: string, sizes = '100vw', maxWidth = 1000) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const key = base && source.startsWith(base + '/') ? source.slice(base.length) : source;
  const image = images[key];
  if (!image) throw new Error(`Missing optimized image: ${key}. Run npm run images:optimize.`);
  const variants = image.images.filter((variant) => variant.width <= maxWidth);
  const fallback = variants.find((variant) => variant.width >= 640) || variants.at(-1)!;
  return {
    src: base + fallback.src,
    srcset: variants.map((variant) => `${base}${variant.src} ${variant.width}w`).join(', '),
    sizes, width: image.width, height: image.height,
  };
};

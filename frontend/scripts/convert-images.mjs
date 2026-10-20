/**
 * Build-time image converter: PNG/JPG → AVIF + WebP (+ optional responsive widths)
 * Runs as prebuild step. Skips files that are already up-to-date.
 */
import sharp from "sharp";
import { existsSync, statSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const images = [
  {
    input: "BannerImage.png",
    avifQuality: 65,
    webpQuality: 72,
    widths: [1280, 1920],
  },
  { input: "our-mission.png", avifQuality: 65, webpQuality: 72 },
  { input: "BeginYourJourney.png", avifQuality: 68, webpQuality: 75 },
  { input: "hero-bg.jpg", avifQuality: 68, webpQuality: 75 },
  { input: "about-hero-bg.jpg", avifQuality: 66, webpQuality: 74, maxWidth: 1920 },
  { input: "service-hero-bg.jpg", avifQuality: 66, webpQuality: 74, maxWidth: 1920 },
  { input: "contact-hero-bg.jpg", avifQuality: 66, webpQuality: 74, maxWidth: 1920 },
  {
    input: "sister-concerns-meher-hero.jpg",
    avifQuality: 65,
    webpQuality: 72,
    maxWidth: 1200,
  },
  {
    input: "package-details.avif",
    avifQuality: 65,
    webpQuality: 72,
    skipAvif: true,
  },
];

function isStale(inputPath, outputPath) {
  if (!existsSync(outputPath)) return true;
  return statSync(inputPath).mtimeMs > statSync(outputPath).mtimeMs;
}

async function writeFormats(src, avifOut, webpOut, avifQuality, webpQuality, needsAvif, needsWebp) {
  if (needsAvif) {
    await src.clone().avif({ quality: avifQuality, effort: 6 }).toFile(avifOut);
  }
  if (needsWebp) {
    await src.clone().webp({ quality: webpQuality, effort: 6 }).toFile(webpOut);
  }
}

let converted = 0;
let skipped = 0;

for (const {
  input,
  avifQuality,
  webpQuality,
  skipAvif,
  widths = [],
  maxWidth,
} of images) {
  const inputPath = join(publicDir, input);
  if (!existsSync(inputPath)) {
    console.warn(`⚠  Skipping ${input} — file not found`);
    continue;
  }

  const stem = basename(input, extname(input));
  const avifOut = join(publicDir, `${stem}.avif`);
  const webpOut = join(publicDir, `${stem}.webp`);

  const needsAvif =
    !skipAvif && (isStale(inputPath, avifOut) || extname(input) === ".avif");
  const needsWebp = isStale(inputPath, webpOut);

  const widthJobs = widths.flatMap((width) => {
    const wAvif = join(publicDir, `${stem}-${width}.avif`);
    const wWebp = join(publicDir, `${stem}-${width}.webp`);
    return [
      {
        width,
        avifOut: wAvif,
        webpOut: wWebp,
        needsAvif: isStale(inputPath, wAvif),
        needsWebp: isStale(inputPath, wWebp),
      },
    ];
  });

  const needsAnyWidth = widthJobs.some((j) => j.needsAvif || j.needsWebp);

  if (!needsAvif && !needsWebp && !needsAnyWidth) {
    console.log(`  ↩  ${input} already up-to-date`);
    skipped++;
    continue;
  }

  try {
    let pipeline = sharp(inputPath);
    if (maxWidth) {
      pipeline = pipeline.resize({
        width: maxWidth,
        withoutEnlargement: true,
      });
    }

    await writeFormats(
      pipeline,
      avifOut,
      webpOut,
      avifQuality,
      webpQuality,
      needsAvif,
      needsWebp,
    );

    for (const job of widthJobs) {
      if (!job.needsAvif && !job.needsWebp) continue;
      const resized = sharp(inputPath).resize({
        width: job.width,
        withoutEnlargement: true,
      });
      await writeFormats(
        resized,
        job.avifOut,
        job.webpOut,
        avifQuality,
        webpQuality,
        job.needsAvif,
        job.needsWebp,
      );
    }

    const widthNote = widths.length ? ` (+ ${widths.join(", ")}w)` : "";
    console.log(`  ✓  ${input} → ${stem}.avif + ${stem}.webp${widthNote}`);
    converted++;
  } catch (err) {
    console.error(`  ✗  Failed to convert ${input}:`, err.message);
  }
}

console.log(
  `\nImage conversion done: ${converted} converted, ${skipped} skipped.\n`,
);

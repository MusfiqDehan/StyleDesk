/**
 * Generates logos, favicons, app icons, and social covers for both brand surfaces:
 *   public/brand/platform/*  — StyleDesk product (sign-in, workspace, API docs)
 *   public/brand/tenant/*    — the salon storefront (/, services, packages, people)
 *
 * All text is converted to vector outlines, so outputs do not depend on installed fonts.
 *
 * Usage (opentype.js is intentionally not a project dependency):
 *   npm i --prefix /tmp/sdtools opentype.js@1
 *   NODE_PATH=/tmp/sdtools/node_modules BRAND_FONT_DIR=/path/to/ttf node scripts/generate-brand-assets.cjs
 *
 * BRAND_FONT_DIR must contain static TTFs named:
 *   inter-500.ttf inter-600.ttf inter-700.ttf inter-800.ttf
 *   playfair-display-700.ttf playfair-display-italic-600.ttf
 * (e.g. from https://cdn.jsdelivr.net/fontsource/fonts/<family>@latest/latin-<weight>-<style>.ttf)
 */
const fs = require('fs')
const path = require('path')
const opentype = require('opentype.js')
const sharp = require('sharp')

const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const FONT_DIR = process.env.BRAND_FONT_DIR
if (!FONT_DIR) throw new Error('Set BRAND_FONT_DIR to a folder with the TTFs listed in the header.')

const font = (name) => opentype.loadSync(path.join(FONT_DIR, `${name}.ttf`))
const F = {
  inter500: font('inter-500'),
  inter600: font('inter-600'),
  inter700: font('inter-700'),
  inter800: font('inter-800'),
  playfair700: font('playfair-display-700'),
  playfairItalic600: font('playfair-display-italic-600'),
}

const C = {
  purple: '#7040c1',
  purpleDeep: '#3b1f73',
  plum: '#b04b9c',
  ink: '#282333',
  muted: '#716b7c',
  lavender: '#eeebf2',
  cream: '#faf8fd',
  white: '#ffffff',
}

const DOMAIN = 'styledesk.musfiqdehan.com'

/** Text as an outlined <path>. `tracking` is in em (0.1 = 10% of font size). */
function text(str, { f, size, x, y, fill, tracking = 0, anchor = 'start', opacity }) {
  const opts = { letterSpacing: tracking, kerning: true }
  const width = f.getAdvanceWidth(str, size, opts)
  const startX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  const d = f.getPath(str, startX, y, size, opts).toPathData(2)
  return `<path d="${d}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`
}
const measure = (str, f, size, tracking = 0) => f.getAdvanceWidth(str, size, { letterSpacing: tracking, kerning: true })

// ── Marks (64×64 artboard) ──────────────────────────────────────────────────

/** Platform: calendar + scissors — salon craft meets simple scheduling. */
function platformGlyph(stroke = C.white) {
  return `<g fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
<rect x="14" y="17" width="36" height="36" rx="8"/><path d="M23 13v8m18-8v8M15 28h34"/>
<circle cx="23" cy="37" r="3.4"/><circle cx="23" cy="46" r="3.4"/><path d="m26 39 14 9m-14-4 14-10"/></g>`
}

/** Tenant: open scissors with a spark — the storefront's "a little glow" motif. */
function tenantGlyph(color = C.white) {
  return `<g fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="22.5" cy="44.5" r="5.6"/><circle cx="41.5" cy="44.5" r="5.6"/>
<path d="M26.4 40.4 42 16.5M37.6 40.4 22 16.5"/></g>
<circle cx="32" cy="31.6" r="1.7" fill="${color}"/>
<path d="M50 9.8l1.25 3.95 3.95 1.25-3.95 1.25L50 20.2l-1.25-3.95L44.8 15l3.95-1.25z" fill="${color}"/>`
}

const defs = `<defs>
<linearGradient id="tenantGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.plum}"/></linearGradient>
<linearGradient id="platformGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8656d6"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
</defs>`

function markSvg(surface, { size = 64, fullBleed = false, safeZone = 1 } = {}) {
  const bg = surface === 'platform' ? 'url(#platformGrad)' : 'url(#tenantGrad)'
  const shape = fullBleed
    ? `<rect width="64" height="64" fill="${bg}"/>`
    : surface === 'platform'
      ? `<rect width="64" height="64" rx="19" fill="${bg}"/>`
      : `<circle cx="32" cy="32" r="32" fill="${bg}"/>`
  const glyph = surface === 'platform' ? platformGlyph() : tenantGlyph()
  const s = safeZone
  const t = (64 - 64 * s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs}${shape}<g transform="translate(${t} ${t}) scale(${s})">${glyph}</g></svg>`
}

function markGroup(surface, x, y, size) {
  const inner = markSvg(surface).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(defs, '')
  return `<g transform="translate(${x} ${y}) scale(${size / 64})">${inner}</g>`
}

// ── Logo lockups ────────────────────────────────────────────────────────────

function platformLogo({ inverse = false } = {}) {
  const name = text('StyleDesk', { f: F.inter700, size: 30, x: 84, y: 36, fill: inverse ? C.white : C.ink, tracking: -0.03 })
  const by = text('by MusfiqDehan', { f: F.inter500, size: 13.5, x: 85, y: 56, fill: inverse ? '#d9ccf5' : C.purple })
  const w = Math.ceil(84 + Math.max(measure('StyleDesk', F.inter700, 30, -0.03), measure('by MusfiqDehan', F.inter500, 13.5)) + 8)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="72" viewBox="0 0 ${w} 72" role="img" aria-label="StyleDesk by MusfiqDehan">${defs}${markGroup('platform', 4, 4, 64)}${name}${by}</svg>`
}

function tenantLogo({ inverse = false } = {}) {
  const name = text('StyleDesk', { f: F.playfair700, size: 32, x: 84, y: 38, fill: inverse ? C.white : C.ink, tracking: -0.01 })
  const tag = text('SALON · BEAUTY · BARBER', { f: F.inter600, size: 10.5, x: 85, y: 56, fill: inverse ? '#e8d8f3' : C.purple, tracking: 0.18 })
  const w = Math.ceil(84 + Math.max(measure('StyleDesk', F.playfair700, 32, -0.01), measure('SALON · BEAUTY · BARBER', F.inter600, 10.5, 0.18)) + 8)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="72" viewBox="0 0 ${w} 72" role="img" aria-label="StyleDesk salon">${defs}${markGroup('tenant', 4, 4, 64)}${name}${tag}</svg>`
}

// ── Social covers (1200×630) ────────────────────────────────────────────────

async function photoDataUri(file, width, height) {
  const buf = await sharp(path.join(PUBLIC, 'images/styledesk', file))
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 86 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

function pill(label, { x, y, f = F.inter700, size = 14, tracking = 0.14, fill, color, padX = 16, h = 34, icon = '' }) {
  const iconW = icon ? 18 : 0
  const w = measure(label, f, size, tracking) + padX * 2 + iconW
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>${icon ? icon(x + padX, y + h / 2) : ''}${text(label, { f, size, x: x + padX + iconW, y: y + h / 2 + size * 0.36, fill: color, tracking })}`,
  }
}

const sparkIcon = (color) => (x, y) =>
  `<path transform="translate(${x + 6} ${y}) scale(0.55)" d="M0-11l2.6 8.4 8.4 2.6-8.4 2.6L0 11l-2.6-8.4L-11 0l8.4-2.6z" fill="${color}"/>`

const arrowIcon = (x, y, color) =>
  `<path d="M${x} ${y + 7}l14-14M${x + 3} ${y - 7}h11v11" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`

async function tenantCover() {
  const main = await photoDataUri('hair.webp', 440, 530)
  const side = await photoDataUri('barber.webp', 210, 210)
  const eyebrow = pill('YOUR NEXT FEEL-GOOD STARTS HERE', { x: 72, y: 142, fill: C.lavender, color: C.purple, size: 13, icon: sparkIcon(C.purple) })
  const cta = pill('Book an appointment', { x: 72, y: 488, f: F.inter600, size: 20, tracking: 0, fill: C.purple, color: C.white, padX: 28, h: 58 })
  cta.w += 30
  cta.svg = cta.svg.replace(/width="[\d.]+"/, `width="${cta.w}"`) + arrowIcon(72 + cta.w - 46, 517, C.white)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${defs}
<defs><clipPath id="main"><rect x="700" y="50" width="440" height="530" rx="40"/></clipPath><clipPath id="side"><rect x="610" y="368" width="210" height="210" rx="30"/></clipPath>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${C.ink}" flood-opacity="0.18"/></filter></defs>
<rect width="1200" height="630" fill="${C.cream}"/>
<circle cx="1120" cy="80" r="260" fill="${C.purple}" opacity="0.07"/><circle cx="60" cy="640" r="220" fill="${C.plum}" opacity="0.06"/>
${markGroup('tenant', 72, 56, 54)}
${text('StyleDesk', { f: F.playfair700, size: 30, x: 140, y: 84, fill: C.ink })}
${text('SALON · BEAUTY · BARBER', { f: F.inter600, size: 11, x: 141, y: 104, fill: C.purple, tracking: 0.18 })}
${eyebrow.svg}
${text('A little glow.', { f: F.playfair700, size: 64, x: 70, y: 262, fill: C.ink, tracking: -0.015 })}
${text('A fresh look.', { f: F.playfair700, size: 64, x: 70, y: 336, fill: C.ink, tracking: -0.015 })}
${text('All you.', { f: F.playfairItalic600, size: 64, x: 70, y: 410, fill: C.purple, tracking: -0.01 })}
${text('Hair, beauty & barbering — book your stylist online.', { f: F.inter500, size: 20, x: 72, y: 458, fill: C.muted })}
${cta.svg}
${text(DOMAIN, { f: F.inter600, size: 16, x: 74, y: 590, fill: C.muted })}
<g filter="url(#shadow)"><image href="${main}" x="700" y="50" width="440" height="530" clip-path="url(#main)" preserveAspectRatio="xMidYMid slice"/></g>
<rect x="602" y="360" width="226" height="226" rx="36" fill="${C.cream}"/>
<g filter="url(#shadow)"><image href="${side}" x="610" y="368" width="210" height="210" clip-path="url(#side)" preserveAspectRatio="xMidYMid slice"/></g>
<g filter="url(#shadow)"><rect x="880" y="84" width="236" height="64" rx="32" fill="${C.white}"/></g>
${markGroup('tenant', 892, 96, 40)}
${text('Good hair.', { f: F.inter700, size: 15, x: 944, y: 112, fill: C.ink })}
${text('Great energy.', { f: F.inter500, size: 14, x: 944, y: 132, fill: C.muted })}
</svg>`
}

function platformCover() {
  const chips = ['Online booking', 'POS & invoices', 'Staff & payroll', 'Inventory', 'Reports']
  let cx = 72
  let cy = 452
  const chipSvg = chips
    .map((label) => {
      const w = measure(label, F.inter600, 15) + 32
      if (cx + w > 640) { cx = 72; cy += 48 }
      const out = `<rect x="${cx}" y="${cy}" width="${w}" height="36" rx="18" fill="${C.white}" opacity="0.13"/>${text(label, { f: F.inter600, size: 15, x: cx + 16, y: cy + 23.5, fill: C.white })}`
      cx += w + 10
      return out
    })
    .join('')

  const bars = [52, 78, 64, 102, 88, 124, 110]
    .map((h, i) => `<rect x="${760 + i * 40}" y="${392 - h}" width="24" height="${h}" rx="6" fill="${i === 5 ? C.purple : '#d9ccf5'}"/>`)
    .join('')
  const rows = [
    ['10:30', 'Hair color · Nadia', C.purple],
    ['11:15', 'Beard trim · Arif', C.plum],
    ['12:00', 'Bridal package · Sara', '#3f9b7a'],
  ]
    .map(([time, label, color], i) => {
      const y = 424 + i * 40
      return `<circle cx="770" cy="${y + 14}" r="12" fill="${color}" opacity="0.18"/><circle cx="770" cy="${y + 14}" r="5" fill="${color}"/>
${text(label, { f: F.inter600, size: 14, x: 792, y: y + 19, fill: C.ink })}
<rect x="1036" y="${y + 2}" width="68" height="24" rx="12" fill="${C.lavender}"/>${text(time, { f: F.inter600, size: 12.5, x: 1070, y: y + 18.5, fill: C.purple, anchor: 'middle' })}`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${defs}
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.purpleDeep}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="${C.white}" opacity="0.09"/></pattern>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#150a2e" flood-opacity="0.45"/></filter></defs>
<rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#dots)"/>
<circle cx="1060" cy="-40" r="300" fill="${C.plum}" opacity="0.25"/>
<rect x="68" y="52" width="62" height="62" rx="20" fill="${C.white}" opacity="0.18"/>
${markGroup('platform', 72, 56, 54)}
${text('StyleDesk', { f: F.inter800, size: 30, x: 142, y: 86, fill: C.white, tracking: -0.03 })}
${text('by MusfiqDehan', { f: F.inter500, size: 14, x: 143, y: 106, fill: '#d9ccf5' })}
${text('SALON MANAGEMENT PLATFORM', { f: F.inter700, size: 14, x: 72, y: 178, fill: '#d9ccf5', tracking: 0.2 })}
${text('Run your salon', { f: F.inter800, size: 62, x: 69, y: 250, fill: C.white, tracking: -0.035 })}
${text('from one desk.', { f: F.inter800, size: 62, x: 69, y: 322, fill: C.white, tracking: -0.035 })}
${text('Bookings, billing, people, and stock —', { f: F.inter500, size: 21, x: 72, y: 374, fill: '#e6ddf7' })}
${text('everything your front desk needs, in one workspace.', { f: F.inter500, size: 21, x: 72, y: 404, fill: '#e6ddf7' })}
${chipSvg}
${text(DOMAIN, { f: F.inter600, size: 16, x: 72, y: 592, fill: '#d9ccf5' })}
<g filter="url(#shadow)"><rect x="720" y="70" width="420" height="498" rx="26" fill="${C.white}"/></g>
<circle cx="748" cy="98" r="6" fill="#f2a7a7"/><circle cx="768" cy="98" r="6" fill="#f5d38f"/><circle cx="788" cy="98" r="6" fill="#a9dcbf"/>
${text('Today', { f: F.inter700, size: 20, x: 744, y: 146, fill: C.ink })}
${text('Tue, 29 Sep', { f: F.inter500, size: 14, x: 1116, y: 146, fill: C.muted, anchor: 'end' })}
<rect x="744" y="164" width="180" height="84" rx="16" fill="${C.lavender}"/>
${text('Appointments', { f: F.inter600, size: 13, x: 760, y: 190, fill: C.muted })}
${text('24', { f: F.inter800, size: 34, x: 760, y: 232, fill: C.ink })}
${text('+6', { f: F.inter700, size: 14, x: 908, y: 232, fill: '#3f9b7a', anchor: 'end' })}
<rect x="936" y="164" width="180" height="84" rx="16" fill="${C.purple}"/>
${text('Revenue', { f: F.inter600, size: 13, x: 952, y: 190, fill: '#e6ddf7' })}
${text('+18%', { f: F.inter800, size: 34, x: 952, y: 232, fill: C.white })}
${bars}
<rect x="744" y="404" width="372" height="1" fill="${C.lavender}"/>
${rows}
</svg>`
}

// ── Raster helpers ──────────────────────────────────────────────────────────

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

/** ICO with embedded PNG frames (supported by every modern browser). */
function ico(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  const dir = Buffer.alloc(16 * frames.length)
  let offset = 6 + dir.length
  frames.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...frames.map((f) => f.data)])
}

async function writeSurface(surface, logoSvg, logoInverseSvg, coverSvg) {
  const out = path.join(PUBLIC, 'brand', surface)
  fs.mkdirSync(out, { recursive: true })
  const write = (name, data) => fs.writeFileSync(path.join(out, name), data)

  const mark = markSvg(surface)
  write('logo-mark.svg', mark)
  write('logo.svg', logoSvg)
  write('logo-inverse.svg', logoInverseSvg)
  const logoMeta = await sharp(Buffer.from(logoSvg)).metadata()
  write('logo.png', await sharp(Buffer.from(logoSvg), { density: 288 }).resize(logoMeta.width * 3).png().toBuffer())

  const frames = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(mark, size) })))
  write('favicon.ico', ico(frames))
  write('favicon-32.png', frames[1].data)
  write('icon-192.png', await png(mark, 192))
  write('icon-512.png', await png(mark, 512))
  write('apple-touch-icon.png', await png(markSvg(surface, { fullBleed: true, safeZone: 0.78 }), 180))
  write('icon-maskable-512.png', await png(markSvg(surface, { fullBleed: true, safeZone: 0.66 }), 512))

  const cover = sharp(Buffer.from(coverSvg), { density: 96 }).resize(1200, 630)
  write('og-cover.png', await cover.clone().png({ compressionLevel: 9, palette: false }).toBuffer())
  write('og-cover.jpg', await cover.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer())
  return out
}

async function main() {
  await writeSurface('platform', platformLogo(), platformLogo({ inverse: true }), platformCover())
  await writeSurface('tenant', tenantLogo(), tenantLogo({ inverse: true }), await tenantCover())

  // Root-level defaults requested by browsers and crawlers before any HTML is parsed.
  const tenant = path.join(PUBLIC, 'brand', 'tenant')
  fs.copyFileSync(path.join(tenant, 'favicon.ico'), path.join(PUBLIC, 'favicon.ico'))
  fs.copyFileSync(path.join(tenant, 'apple-touch-icon.png'), path.join(PUBLIC, 'apple-touch-icon.png'))
  fs.copyFileSync(path.join(tenant, 'logo-mark.svg'), path.join(PUBLIC, 'icon.svg'))
  fs.copyFileSync(path.join(PUBLIC, 'brand', 'platform', 'logo-mark.svg'), path.join(PUBLIC, 'brand', 'logo-mark.svg'))
  fs.copyFileSync(path.join(PUBLIC, 'brand', 'platform', 'logo.svg'), path.join(PUBLIC, 'brand', 'styledesk-logo.svg'))
  console.log('Brand assets written to public/brand/{platform,tenant}')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

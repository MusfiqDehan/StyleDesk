/** Responsive LCP hero media — sized AVIF/WebP via srcset, no full 3000px on mobile. */
export function HeroBanner() {
  return (
    <div className="hero-bg-zoom absolute inset-0">
      <picture>
        <source
          type="image/avif"
          srcSet="/BannerImage-1280.avif 1280w, /BannerImage-1920.avif 1920w, /BannerImage.avif 3000w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/BannerImage-1280.webp 1280w, /BannerImage-1920.webp 1920w, /BannerImage.webp 3000w"
          sizes="100vw"
        />
        <img
          src="/BannerImage-1920.webp"
          alt=""
          width={1920}
          height={1440}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      </picture>
    </div>
  )
}

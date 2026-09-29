export type SalonPackage = {
  id: string;
  category?: string;
  title: string;
  price: number | string;
  billingCycle?: string;
  description?: string;
  features?: string[];
  imageUrl?: string;
  image?: string;
  coverImage?: string;
  popular?: boolean;
  createdAt?: string | Date | null;
};

export function packagePhoto(pkg: Pick<SalonPackage, "category" | "title">) {
  const hay = `${pkg.category || ""} ${pkg.title || ""}`.toLowerCase();
  if (/barber|beard|shave|fade|groom/.test(hay))
    return { file: "barber", alt: "Barber creating a fresh haircut" };
  if (/make|bridal|glam/.test(hay))
    return { file: "makeup", alt: "Makeup being applied for a special occasion" };
  if (/skin|facial|spa|glow/.test(hay))
    return { file: "spa", alt: "A relaxing facial treatment" };
  if (/color|highlight/.test(hay))
    return { file: "color", alt: "Stylist sectioning hair for a color treatment" };
  if (/cut|hair|style|blow/.test(hay))
    return { file: "wash", alt: "Hair being cut in the salon" };
  return { file: "studio", alt: "A bright salon treatment space" };
}

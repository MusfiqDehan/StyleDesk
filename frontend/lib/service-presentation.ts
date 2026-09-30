import type { Service } from "@/lib/types";

export function servicePhoto(service: Pick<Service, "category" | "name">) {
  if (/barber|beard|shave|fade/i.test(service.name))
    return { file: "barber", alt: "Barber creating a fresh haircut" };
  switch (service.category.toLowerCase()) {
    case "hair":
      return { file: "blowout", alt: "Stylist blow-drying a client's hair" };
    case "makeup":
    case "bridal":
      return {
        file: "makeup",
        alt: "Close-up of makeup being applied with a brush",
      };
    case "skin":
    case "spa":
      return { file: "beauty", alt: "Therapist providing a facial treatment" };
    default:
      return {
        file: "studio",
        alt: "Bright, contemporary salon treatment space",
      };
  }
}

export function serviceIntro(category: string) {
  switch (category.toLowerCase()) {
    case "hair":
      return "A little refresh or a new direction. Make room for a look that feels like you.";
    case "skin":
      return "Take a breath and give your skin a little attention. Your reset starts here.";
    case "makeup":
    case "bridal":
      return "A polished finish for the moments you want to feel your most confident.";
    case "nails":
      return "It’s the little details. Add a fresh finish to your everyday routine.";
    case "spa":
      return "Step away from the busy and make a little space to unwind.";
    default:
      return "Make this part of your next visit and give yourself a little extra care.";
  }
}

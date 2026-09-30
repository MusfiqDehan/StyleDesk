export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  customRole?: string;
  about?: string | null;
  image?: string | null;
  specializations?: string[] | string;
  experience?: number | string;
};

export const ROLE_BIOS: Record<string, string> = {
  Artist:
    "Cuts, color, and finishing touches with an eye for what feels like you.",
  Manager: "Keeps the day running smoothly so your visit feels easy from the start.",
  Receptionist:
    "The friendly first hello — here to help you find a time that works.",
  Assistant: "A rising stylist, happy to help and always learning the craft.",
  Other: "Part of the team that makes your visit feel personal and unhurried.",
};

export function memberRoleLabel(member: Pick<TeamMember, "role" | "customRole">) {
  if (member.role === "Other") return member.customRole || member.role || "Specialist";
  return member.role || "Specialist";
}

export function memberBio(member: TeamMember) {
  if (member.about?.trim()) return member.about.trim();
  const key =
    member.role === "Stylist" || member.role === "Artist" ? "Artist" : member.role || "Other";
  return ROLE_BIOS[key] || ROLE_BIOS.Other;
}

export function memberSpecialties(member: TeamMember) {
  if (Array.isArray(member.specializations)) {
    return member.specializations.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof member.specializations === "string" && member.specializations.trim()) {
    return member.specializations.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function memberInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export enum ServiceCategory {
  HAIR = 'Hair',
  SKIN = 'Skin',
  NAILS = 'Nails',
  MAKEUP = 'Makeup',
  SPA = 'Spa',
  BRIDAL = 'Bridal',
  OTHER = 'Other',
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  duration: number;
  description: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

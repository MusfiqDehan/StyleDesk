import { headers } from "next/headers";
import { isPlatformHostname } from "@/lib/platform-host";
import { tenantOrigin } from "@/lib/tenant-fetch";
import { fetchBusinessInfoForMetadata } from "@/lib/business-branding-server";
import { resolveBusinessName } from "@/lib/business-branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = (await headers()).get("host") ?? "";
  const origin = await tenantOrigin();
  const isPlatform = isPlatformHostname(host);

  if (isPlatform) {
    const content = `# StyleDesk
> StyleDesk is a modern, all-in-one multi-tenant salon, barbershop, and spa management platform. It streamlines appointment booking, point-of-sale (POS), biometric staff attendance, payroll, inventory, and business intelligence in a unified cloud workspace.

## Overview
- **Product Name**: StyleDesk
- **Official Website**: ${origin}
- **API Documentation**: ${origin}/api/docs
- **Swagger JSON**: ${origin}/api/docs-json
- **Target Audience**: Hair salons, beauty parlors, barbershops, day spas, wellness clinics, and nail studios.
- **Architectural Tenancy**: Isolated multi-tenant architecture with PostgreSQL Row-Level Security (RLS), custom salon subdomains, and automated Traefik reverse-proxy with SSL/TLS termination.

## Core Capabilities
- **Online Booking System**: Instant self-service booking, service/package catalog selection, preferred stylist selection, and automated appointment confirmations.
- **Point of Sale (POS)**: Fast counter transactions, card/cash/split tender payments, invoice issuance, promotional vouchers, discount codes, and held tickets.
- **Biometric Attendance & Time Tracking**: Hardware-level integration with ZKTeco ADMS push biometric time clocks for verified employee clock-in and punch logging.
- **Staff, Commission & Payroll**: Role-based access control (RBAC), multi-tier roles (Admin, Store Manager, Stylist, Cashier, Receptionist), automated pay slip generation, and attendance deductions.
- **Inventory & Stock Management**: Product catalog, batch tracking, low-stock alerts, supplier logging, and consumption accounting.
- **Multi-Branch Network**: Centralized multi-location control, cross-branch reporting, and branch switching for salon managers.
- **Custom Domains & Branding**: White-label custom salon subdomains (e.g., client1.styledesk.musfiqdehan.com) and dedicated apex/custom domains with automated HTTPS verification.

## Key Endpoints & Pages
- Platform Landing Page: ${origin}/
- Feature Comparison & Pricing: ${origin}/#plan-comparison
- Platform Registration & Onboarding: ${origin}/platform-ui/register
- Platform Sign In: ${origin}/login
- Swagger API Docs: ${origin}/api/docs
- Health & System Ping: ${origin}/api/health
`;

    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  // Tenant salon LLM context
  const info = await fetchBusinessInfoForMetadata();
  const salonName = resolveBusinessName(info?.businessName);

  const content = `# ${salonName}
> Hair, beauty, and barbering salon. Experience premier salon styling, hair care, and beauty treatments. Book appointments online in minutes with our top stylists.

## Business Details
- **Salon**: ${salonName}
- **Website**: ${origin}
- **Phone**: ${info?.phone || "Available on website"}
- **Email**: ${info?.email || "Available on website"}
- **Address**: ${info?.address || "Available on website"}

## Available Pages
- Home: ${origin}/
- Services Menu: ${origin}/services
- Curated Packages: ${origin}/packages
- Our Stylists & Team: ${origin}/our-team
- Contact & Directions: ${origin}/contact
- Customer Portal: ${origin}/customer-dashboard
- Book Appointment: ${origin}/services
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

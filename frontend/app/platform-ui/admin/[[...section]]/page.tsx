import { PlatformPanel } from "@/components/platform/panel";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <PlatformPanel section={section ?? []} />;
}

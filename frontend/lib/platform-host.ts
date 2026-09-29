export function isPlatformHostname(host: string): boolean {
  return (
    host.toLowerCase().replace(/:\d+$/, "") ===
    (process.env.PLATFORM_HOST ?? "localhost")
  );
}

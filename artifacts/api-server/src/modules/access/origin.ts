export function trustedOrigin(origin: string, host: string | undefined, configured: string | undefined): boolean {
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) return false;
    return url.host === host || (configured ?? "").split(",").map(v => v.trim()).includes(url.origin);
  } catch { return false; }
}

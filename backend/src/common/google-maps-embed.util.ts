export function isEmbeddableGoogleMapsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes('google.')) return false;
    if (parsed.pathname.startsWith('/maps/embed')) return true;
    if (parsed.searchParams.get('output') === 'embed') return true;
    return false;
  } catch {
    return false;
  }
}

export function isGoogleMapsShortLink(url: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url.trim());
}

export function parseGoogleMapsUrlToEmbed(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isEmbeddableGoogleMapsUrl(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);

    const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      return `https://www.google.com/maps?q=${atMatch[1]},${atMatch[2]}&z=15&output=embed`;
    }

    const dataMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dataMatch) {
      return `https://www.google.com/maps?q=${dataMatch[1]},${dataMatch[2]}&z=15&output=embed`;
    }

    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@?]+)/);
    if (placeMatch) {
      const place = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      return `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
    }

    const query = parsed.searchParams.get('q') || parsed.searchParams.get('query');
    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }

    if (parsed.hostname.includes('google.') && parsed.pathname.includes('/maps')) {
      const separator = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${separator}output=embed`;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveGoogleMapsEmbedUrl(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = parseGoogleMapsUrlToEmbed(trimmed);
  if (direct) return direct;

  if (!isGoogleMapsShortLink(trimmed) && !trimmed.includes('google.com/maps')) {
    return null;
  }

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StyleDesk/1.0)',
      },
    });
    return parseGoogleMapsUrlToEmbed(response.url);
  } catch {
    return null;
  }
}

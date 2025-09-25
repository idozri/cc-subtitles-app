import { NextResponse } from 'next/server';

async function fetchFromWebfontsApi(apiKey: string) {
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(
    apiKey
  )}&sort=popularity`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error('webfonts_api_failed');
  const data = await res.json();
  const items = Array.isArray(data.items)
    ? data.items.map((f: any) => ({
        family: f.family as string,
        category: f.category as string,
        variants: (f.variants as string[]) ?? [],
        files: (f.files as Record<string, string>) ?? {},
      }))
    : [];
  return items;
}

async function fetchFromFontsMetadata() {
  // This endpoint does not require an API key. It returns text with an anti-XSSI prefix we must strip.
  const res = await fetch('https://fonts.google.com/metadata/fonts', {
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error('metadata_api_failed');
  const text = await res.text();
  const jsonText = text.replace(/^\)]}'\n?/, '');
  const data = JSON.parse(jsonText);
  const list = Array.isArray(data.familyMetadataList)
    ? data.familyMetadataList
    : [];
  const items = list.map((f: any) => ({
    family: String(f.family),
    category: String(f.category || ''),
    variants: Array.isArray(f.fonts)
      ? Array.from(
          new Set(
            f.fonts.map((ff: any) =>
              ff.italic ? `${ff.weight}i` : String(ff.weight)
            )
          )
        )
      : [],
    files: {},
  }));
  return items;
}

// GET /api/google-fonts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const apiKey = process.env.GOOGLE_FONTS_API_KEY;
    let items: any[] = [];

    if (apiKey) {
      try {
        items = await fetchFromWebfontsApi(apiKey);
      } catch {
        // Fall back to metadata if the Webfonts API fails
        items = await fetchFromFontsMetadata();
      }
    } else {
      // No key provided, use metadata fallback
      items = await fetchFromFontsMetadata();
    }

    if (q) {
      items = items.filter((f) => String(f.family).toLowerCase().includes(q));
    }

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to load fonts' },
      { status: 502 }
    );
  }
}

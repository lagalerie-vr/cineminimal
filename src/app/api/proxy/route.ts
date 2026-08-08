import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin,
      },
      next: { revalidate: 0 } // Don't cache proxy responses
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch: ${response.statusText}`, { status: response.status });
    }

    let html = await response.text();

    // The goal here is to serve the HTML but allow us to manipulate it if needed.
    // For now, we'll return it as is, but this provides a bridge to strip scripts later.
    
    // One specific trick: If the site uses absolute paths for scripts, they might break.
    // We can try to fix them by injecting a <base> tag.
    const baseUrl = new URL(targetUrl).origin;
    html = html.replace('<head>', `<head><base href="${baseUrl}/">`);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'ALLOWALL', // Try to bypass some framing restrictions
      },
    });
  } catch (error: any) {
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 });
  }
}

import { apiUrl } from "./apiBase";
const jseshCache = new Map<string, string>();

export async function fetchJseshBase64(mdc: string, height: number = 50, centered: boolean = true) {
  if (!mdc) return null;
  const cacheKey = `${mdc}|${height}|${centered}`;
  if (jseshCache.has(cacheKey)) {
    return jseshCache.get(cacheKey) || null;
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5 second timeout

    const response = await fetch(
      apiUrl(`/jsesh/${encodeURIComponent(mdc)}?height=${height}&centered=${centered}`),
      { signal: controller.signal }
    );

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }
    const base64 = await response.text();
    if (base64) {
      jseshCache.set(cacheKey, base64);
    }
    return base64 || null;
  } catch (error) {
    // Clear timeout if still pending
    if (timeoutId) clearTimeout(timeoutId);

    // Handle abort errors (timeout or request cancellation) silently
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }

    // For other errors, log in development and silently fail
    if (process.env.NODE_ENV === 'development') {
      console.debug("JSesh image fetch failed:", error);
    }
    return null;
  }
}

export function getJseshRenderHeight(baseHeight: number) {
  // Render at higher resolution and scale down for sharper glyphs.
  const scaled = Math.round(baseHeight * 2);
  return Math.min(scaled, 128);
}

export function getJseshImageUrl(base64: string) {
  return `data:image/png;base64,${base64}`;
}

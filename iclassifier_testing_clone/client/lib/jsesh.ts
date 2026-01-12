const jseshCache = new Map<string, string>();

export async function fetchJseshBase64(mdc: string, height: number = 50, centered: boolean = true) {
  if (!mdc) return null;
  const cacheKey = `${mdc}|${height}|${centered}`;
  if (jseshCache.has(cacheKey)) {
    return jseshCache.get(cacheKey) || null;
  }

  try {
    const response = await fetch(
      `/api/jsesh/${encodeURIComponent(mdc)}?height=${height}&centered=${centered}`
    );
    if (!response.ok) {
      return null;
    }
    const base64 = await response.text();
    if (base64) {
      jseshCache.set(cacheKey, base64);
    }
    return base64 || null;
  } catch (error) {
    console.error("JSesh fetch failed:", error);
    return null;
  }
}

export function getJseshImageUrl(base64: string) {
  return `data:image/png;base64,${base64}`;
}

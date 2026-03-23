import { apiUrl } from "./apiBase";
const jseshCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string | null>>();

// 1x1 transparent PNG placeholder returned by server when JSesh Docker is unreachable
const PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// Concurrency limiter to avoid overwhelming the JSesh Docker service
const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];
const retryCountMap = new Map<string, number>();

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot() {
  activeRequests--;
  if (requestQueue.length > 0) {
    const next = requestQueue.shift()!;
    next();
  }
}

export async function fetchJseshBase64(mdc: string, height: number = 50, centered: boolean = true) {
  const normalizedMdc = mdc.trim();
  if (!normalizedMdc) return null;

  const cacheKey = `${normalizedMdc}|${height}|${centered}`;
  if (jseshCache.has(cacheKey)) {
    return jseshCache.get(cacheKey) || null;
  }

  // Deduplicate concurrent callers for the same glyph request.
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) || null;
  }

  const requestPromise = fetchJseshBase64Inner(normalizedMdc, height, centered, cacheKey);
  inFlightRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

async function fetchJseshBase64Inner(
  normalizedMdc: string,
  height: number,
  centered: boolean,
  cacheKey: string,
) {

  await acquireSlot();

  // Re-check cache after acquiring slot (another request may have filled it)
  if (jseshCache.has(cacheKey)) {
    releaseSlot();
    return jseshCache.get(cacheKey) || null;
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 second timeout (longer to account for queuing)

    console.log(`[JSesh] Fetching: ${normalizedMdc} (height: ${height}, centered: ${centered})`);

    const response = await fetch(
      apiUrl(`/jsesh/${encodeURIComponent(normalizedMdc)}?height=${height}&centered=${centered}`),
      { signal: controller.signal }
    );

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[JSesh] HTTP ${response.status} for ${normalizedMdc}:`, response.statusText);
      return null;
    }
    let base64 = await response.text();
    console.log(`[JSesh] Received ${base64.length} chars for ${normalizedMdc}`);
    
    // Strip injected script tags that may be added by proxies (development only)
    base64 = base64.split("<script")[0].trim();

    // Reject the 1x1 transparent placeholder (means JSesh Docker was unreachable)
    if (!base64 || base64 === PLACEHOLDER_BASE64) {
      console.warn(`[JSesh] Received placeholder (empty image) for ${normalizedMdc}, not caching`);
      // Schedule a retry after a delay (JSesh Docker may still be warming up)
      const retryKey = `retry|${cacheKey}`;
      const retryCount = (retryCountMap.get(retryKey) ?? 0) + 1;
      if (retryCount <= MAX_RETRIES) {
        retryCountMap.set(retryKey, retryCount);
        const delay = retryCount * 2000; // 2s, 4s, 6s
        setTimeout(() => {
          fetchJseshBase64(normalizedMdc, height, centered);
        }, delay);
      }
      return null;
    }

    jseshCache.set(cacheKey, base64);
    console.log(`[JSesh] Cached ${normalizedMdc} successfully`);
    return base64;
  } catch (error) {
    // Clear timeout if still pending
    if (timeoutId) clearTimeout(timeoutId);

    // Handle abort errors (timeout or request cancellation) silently
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[JSesh] Timeout for ${normalizedMdc}`);
      return null;
    }

    // For other errors, log in development and silently fail
    console.warn(`[JSesh] Error fetching ${normalizedMdc}:`, error);
    return null;
  } finally {
    releaseSlot();
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

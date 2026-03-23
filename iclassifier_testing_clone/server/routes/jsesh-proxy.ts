import { Router, Request, Response } from "express";

const router = Router();

const jseshCandidates = (() => {
  const configured = (process.env.JSESH_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const primary = process.env.JSESH_URL?.trim();
  const defaults = [
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:30000",
    "http://localhost:30000",
    "http://jsesh:30000",
  ];
  return Array.from(new Set([...configured, ...(primary ? [primary] : []), ...defaults]));
})();

async function fetchFromJsesh(pathWithQuery: string): Promise<Response> {
  let lastError: unknown;

  for (const baseUrl of jseshCandidates) {
    const url = `${baseUrl}${pathWithQuery}`;
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`JSesh upstream ${baseUrl} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("JSesh service not reachable");
}

function getNormalizedMdc(req: Request): string {
  const pathMdc = typeof req.params?.mdc === "string" ? req.params.mdc : "";
  const queryMdc = req.query?.mdc;
  const queryUpperMdc = req.query?.MDC;
  const queryTransliteration = req.query?.transliteration;

  const firstString = [pathMdc, queryMdc, queryUpperMdc, queryTransliteration]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value.length > 0);

  return firstString || "";
}

async function proxyJsesh(req: Request, res: Response) {
  const normalizedMdc = getNormalizedMdc(req);
  const height = req.query.height || "50";
  const centered = req.query.centered || "true";

  if (!normalizedMdc) {
    res.status(400).send("Missing mdc parameter");
    return;
  }

  try {
    const response = await fetchFromJsesh(
      `/jsesh?height=${height}&centered=${centered}&mdc=${encodeURIComponent(normalizedMdc)}`
    );

    const base64 = await response.text();
    // Strip the script tag if it was injected by a proxy
    const cleanBase64 = base64.split("<script")[0].trim();
    res.type("application/octet-stream")
      .set("X-Content-Type-Options", "nosniff")
      .set("Content-Disposition", "inline; filename=\"image.png\"")
      .set("Cache-Control", "public, max-age=31536000")
      .send(cleanBase64);
  } catch (error) {
    console.error("JSesh proxy error:", error);
    res.status(502).send("Error connecting to JSesh service");
  }
}

router.get("/:mdc", async (req: Request, res: Response) => {
  await proxyJsesh(req, res);
});

// Legacy compatibility: accept query-style access (/jsesh?mdc=... or ?MDC=...)
router.get("/", async (req: Request, res: Response) => {
  await proxyJsesh(req, res);
});

export default router;

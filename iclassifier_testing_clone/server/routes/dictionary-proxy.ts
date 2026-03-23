import { Router, Request, Response } from "express";

const router = Router();

const dictionaryCandidates = (() => {
  const configured = (process.env.DICTIONARY_URLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const primary = process.env.DICTIONARY_URL?.trim();
  const defaults = ["http://127.0.0.1:8090", "http://dictionary:8090"];

  const deduped = new Set<string>();
  [...configured, ...(primary ? [primary] : []), ...defaults].forEach((url) => {
    if (url) deduped.add(url.replace(/\/+$/, ""));
  });
  return Array.from(deduped);
})();

async function fetchFromDictionary(pathWithQuery: string) {
  let lastError: unknown = null;

  for (const baseUrl of dictionaryCandidates) {
    try {
      const response = await fetch(`${baseUrl}${pathWithQuery}`);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Dictionary service not reachable");
}

router.get("/:dictId/byid", async (req: Request, res: Response) => {
  const { dictId } = req.params;
  const id = req.query.id;

  if (!id) {
    res.status(400).json({ error: "Missing id parameter" });
    return;
  }

  try {
    const response = await fetchFromDictionary(`/dictionary/${dictId}/byid?id=${id}`);
    if (!response.ok) {
      const message = await response.text();
      res.status(response.status >= 500 ? 502 : response.status).send(message || "Dictionary service error");
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Dictionary proxy error:", error);
    res.status(502).send("Error connecting to dictionary service");
  }
});

router.get("/:dictId/bysubstring", async (req: Request, res: Response) => {
  const { dictId } = req.params;
  const substr = req.query.substr;
  const type = req.query.type || "all";

  if (!substr) {
    res.status(400).json({ error: "Missing substr parameter" });
    return;
  }

  try {
    const response = await fetchFromDictionary(
      `/dictionary/${dictId}/bysubstring?substr=${encodeURIComponent(
        String(substr),
      )}&type=${encodeURIComponent(String(type))}`
    );
    if (!response.ok) {
      const message = await response.text();
      res.status(response.status >= 500 ? 502 : response.status).send(message || "Dictionary service error");
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Dictionary proxy error:", error);
    res.status(502).send("Error connecting to dictionary service");
  }
});

export default router;

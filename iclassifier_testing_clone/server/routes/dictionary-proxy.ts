import { Router, Request, Response } from "express";

const router = Router();

const DICTIONARY_URL = process.env.DICTIONARY_URL || "http://127.0.0.1:8090";

router.get("/:dictId/byid", async (req: Request, res: Response) => {
  const { dictId } = req.params;
  const id = req.query.id;

  if (!id) {
    res.status(400).json({ error: "Missing id parameter" });
    return;
  }

  try {
    const response = await fetch(`${DICTIONARY_URL}/dictionary/${dictId}/byid?id=${id}`);
    if (!response.ok) {
      const message = await response.text();
      res.status(502).send(message || "Dictionary service error");
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
    const response = await fetch(
      `${DICTIONARY_URL}/dictionary/${dictId}/bysubstring?substr=${encodeURIComponent(
        String(substr)
      )}&type=${encodeURIComponent(String(type))}`
    );
    if (!response.ok) {
      const message = await response.text();
      res.status(502).send(message || "Dictionary service error");
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

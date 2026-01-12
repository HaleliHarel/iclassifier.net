import { Router, Request, Response } from "express";

const router = Router();

const JSESH_URL = process.env.JSESH_URL || "http://127.0.0.1:8080";

router.get("/:mdc", async (req: Request, res: Response) => {
  const { mdc } = req.params;
  const height = req.query.height || "50";
  const centered = req.query.centered || "true";

  try {
    const response = await fetch(
      `${JSESH_URL}/jsesh?height=${height}&centered=${centered}&mdc=${encodeURIComponent(mdc)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const message = await response.text();
      res.status(502).send(message || "JSesh service error");
      return;
    }

    const base64 = await response.text();
    res.type("text/plain").send(base64);
  } catch (error) {
    // Silent fail for JSesh service - return placeholder
    res.status(200).send("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
  }
});

export default router;

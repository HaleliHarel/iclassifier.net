import { Router, Request, Response } from "express";
import { getProjectDB, resolveDatabaseDir } from "../database/iclassifier-db";
import fs from "fs";
import path from "path";

const router = Router();

const toNumber = (value: any, fallback: number) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapToken = (token: any) => ({
  id: token.id,
  lemma_id: token.lemma_id,
  mdc_w_markup: token.mdc_w_markup,
  mdc: token.mdc,
  witness_id: token.witness_id,
  compound_id: token.compound_id,
  supertext_id: token.supertext_id,
  coordinates_in_txt: token.coordinates_in_txt,
  coordinates_in_witness: token.coordinates_in_witness,
  transliteration: token.transliteration,
  classification_status: token.classification_status,
  sign_comments: token.sign_comments,
  context_meaning: token.context_meaning,
  syntactic_relation: token.syntactic_relation,
  register: token.register,
  comments: token.comments,
  other: token.other,
  phonetic_reconstruction: token.phonetic_reconstruction,
  translation: token.translation,
  tla_sentence_id: token.tla_sentence_id,
  pos: token.pos,
});

/**
 * Test endpoint to check if basic API is working
 */
router.get("/test", (req: Request, res: Response) => {
  console.log("[API] Test endpoint hit");
  res.json({ status: "API working", timestamp: new Date().toISOString() });
});

/**
 * Get all lemmas for a project
 * GET /api/iclassifier/:projectId/lemmas
 */
router.get("/:projectId/lemmas", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const lemmas = await db.getLemmas();
    db.close();

    // Transform to match React interface
    const lemmaMap: Record<number, any> = {};
    (lemmas as any[]).forEach((lemma) => {
      lemmaMap[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || "",
      };
    });

    res.json(lemmaMap);
  } catch (error) {
    console.error("Error fetching lemmas:", error);
    res.status(500).json({ error: "Failed to fetch lemmas" });
  }
});

/**
 * Get lemmas with pagination (optionally with token counts)
 * GET /api/iclassifier/:projectId/lemmas/paged
 */
router.get("/:projectId/lemmas/paged", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const search = String(req.query.search || "");
  const limit = toNumber(req.query.limit, 50);
  const offset = toNumber(req.query.offset, 0);
  const withCounts = String(req.query.withCounts || "true") === "true";

  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getLemmasPaged(search, limit, offset, withCounts);
    db.close();

    const lemmas = items.map((lemma) => ({
      id: lemma.id,
      transliteration: lemma.transliteration || "",
      meaning: lemma.meaning || "",
      token_count: lemma.token_count ?? 0,
    }));

    res.json({ items: lemmas, total });
  } catch (error) {
    console.error("Error fetching paged lemmas:", error);
    res.status(500).json({ error: "Failed to fetch lemmas" });
  }
});

/**
 * Get all tokens for a project
 * GET /api/iclassifier/:projectId/tokens
 */
router.get("/:projectId/tokens", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const tokens = await db.getTokens();
    db.close();

    // Transform to match React interface
    const tokenMap: Record<number, any> = {};
    (tokens as any[]).forEach((token) => {
      tokenMap[token.id] = mapToken(token);
    });

    res.json(tokenMap);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

/**
 * Get tokens for a lemma with pagination and filters
 * GET /api/iclassifier/:projectId/tokens/by-lemma/:lemmaId
 */
router.get("/:projectId/tokens/by-lemma/:lemmaId", async (req: Request, res: Response) => {
  const { projectId, lemmaId } = req.params;
  const limit = toNumber(req.query.limit, 200);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = (req.query.tokenType as string) || "all";
  const witnesses = String(req.query.witnesses || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const scripts = String(req.query.scripts || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getTokensByLemma(Number(lemmaId), {
      witnessIds: witnesses,
      scripts,
      tokenType: tokenType as any,
      limit,
      offset,
    });
    db.close();

    res.json({
      items: items.map(mapToken),
      total,
    });
  } catch (error) {
    console.error("Error fetching tokens by lemma:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

/**
 * Get tokens for a classifier with pagination and filters
 * GET /api/iclassifier/:projectId/tokens/by-classifier/:classifier
 */
router.get("/:projectId/tokens/by-classifier/:classifier", async (req: Request, res: Response) => {
  const { projectId, classifier } = req.params;
  const limit = toNumber(req.query.limit, 200);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = (req.query.tokenType as string) || "all";
  const witnesses = String(req.query.witnesses || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const scripts = String(req.query.scripts || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getTokensByClassifier(String(classifier), {
      witnessIds: witnesses,
      scripts,
      tokenType: tokenType as any,
      limit,
      offset,
    });
    db.close();

    res.json({
      items: items.map(mapToken),
      total,
    });
  } catch (error) {
    console.error("Error fetching tokens by classifier:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

/**
 * Get tokens by ids
 * GET /api/iclassifier/:projectId/tokens/by-ids?ids=1,2,3
 */
router.get("/:projectId/tokens/by-ids", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const ids = String(req.query.ids || "")
    .split(",")
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));

  try {
    const db = getProjectDB(projectId);
    const items = await db.getTokensByIds(ids);
    db.close();
    res.json({ items: items.map(mapToken) });
  } catch (error) {
    console.error("Error fetching tokens by ids:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

/**
 * Get all witnesses for a project
 * GET /api/iclassifier/:projectId/witnesses
 */
router.get("/:projectId/witnesses", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const witnesses = await db.getWitnesses();
    db.close();

    // Transform to match React interface
    const witnessMap: Record<string, any> = {};
    (witnesses as any[]).forEach((witness) => {
      witnessMap[witness.id] = {
        id: witness.id,
        name: witness.name,
        script: witness.script,
        genre: witness.genre,
        object_type: witness.object_type,
        location: witness.location,
        period_date_start: witness.period_date_start,
        period_date_end: witness.period_date_end,
        chrono_date_start: witness.chrono_date_start,
        chrono_date_end: witness.chrono_date_end,
        url: witness.url,
        comments: witness.comments,
        supertext_id: witness.supertext_id,
      };
    });

    res.json(witnessMap);
  } catch (error) {
    console.error("Error fetching witnesses:", error);
    res.status(500).json({ error: "Failed to fetch witnesses" });
  }
});

/**
 * Get witnesses with pagination
 * GET /api/iclassifier/:projectId/witnesses/paged
 */
router.get("/:projectId/witnesses/paged", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const search = String(req.query.search || "");
  const limit = toNumber(req.query.limit, 100);
  const offset = toNumber(req.query.offset, 0);

  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getWitnessesPaged(search, limit, offset);
    db.close();

    const witnesses = items.map((witness) => ({
      id: witness.id,
      name: witness.name,
      script: witness.script,
      genre: witness.genre,
      object_type: witness.object_type,
      location: witness.location,
      period_date_start: witness.period_date_start,
      period_date_end: witness.period_date_end,
      chrono_date_start: witness.chrono_date_start,
      chrono_date_end: witness.chrono_date_end,
      url: witness.url,
      comments: witness.comments,
      supertext_id: witness.supertext_id,
    }));

    res.json({ items: witnesses, total });
  } catch (error) {
    console.error("Error fetching paged witnesses:", error);
    res.status(500).json({ error: "Failed to fetch witnesses" });
  }
});

/**
 * Get distinct scripts for a project
 * GET /api/iclassifier/:projectId/scripts
 */
router.get("/:projectId/scripts", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const scripts = await db.getScripts();
    db.close();
    res.json(scripts);
  } catch (error) {
    console.error("Error fetching scripts:", error);
    res.status(500).json({ error: "Failed to fetch scripts" });
  }
});

/**
 * Get classifier list with pagination
 * GET /api/iclassifier/:projectId/classifiers
 */
router.get("/:projectId/classifiers", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const search = String(req.query.search || "");
  const limit = toNumber(req.query.limit, 200);
  const offset = toNumber(req.query.offset, 0);

  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getClassifierValuesPaged(search, limit, offset);
    db.close();
    res.json({ items, total });
  } catch (error) {
    console.error("Error fetching classifiers:", error);
    res.status(500).json({ error: "Failed to fetch classifiers" });
  }
});

/**
 * Get classifier metadata for a project
 * GET /api/iclassifier/:projectId/classifier-metadata
 */
router.get(
  "/:projectId/classifier-metadata",
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    try {
      const db = getProjectDB(projectId);
      const classifiers = await db.getClassifierMetadata();
      db.close();

      // Return as array for easy iteration
      res.json(classifiers);
    } catch (error) {
      console.error("Error fetching classifier metadata:", error);
      res.status(500).json({ error: "Failed to fetch classifier metadata" });
    }
  }
);

/**
 * Get classifier meanings for a project
 * GET /api/iclassifier/:projectId/classifier-meanings
 */
router.get("/:projectId/classifier-meanings", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const classifierMeanings = await db.getClassifierMeanings();
    db.close();
    res.json(classifierMeanings);
  } catch (error) {
    console.error("Error fetching classifier meanings:", error);
    res.status(500).json({ error: "Failed to fetch classifier meanings" });
  }
});

/**
 * Query tokens with filters and pagination
 * GET /api/iclassifier/:projectId/query
 */
router.get("/:projectId/query", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const limit = toNumber(req.query.limit, 100);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = (req.query.tokenType as string) || "all";
  const lemmas = String(req.query.lemmas || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const witnesses = String(req.query.witnesses || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const scripts = String(req.query.scripts || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const classifier = String(req.query.classifier || "");
  const regexPattern = String(req.query.regex || "");

  try {
    const db = getProjectDB(projectId);
    let tokens: any[] = [];

    if (classifier) {
      const response = await db.getTokensByClassifier(classifier, {
        witnessIds: witnesses,
        scripts,
        tokenType: tokenType as any,
      });
      tokens = response.items;
    } else {
      let sql = "SELECT DISTINCT t.* FROM tokens t";
      const clauses: string[] = [];
      const params: any[] = [];

      if (scripts.length > 0) {
        sql += " LEFT JOIN witnesses w ON w.id = t.witness_id";
        clauses.push(`w.script IN (${scripts.map(() => "?").join(",")})`);
        params.push(...scripts);
      }

      if (lemmas.length > 0) {
        clauses.push(`t.lemma_id IN (${lemmas.map(() => "?").join(",")})`);
        params.push(...lemmas);
      }

      if (witnesses.length > 0) {
        clauses.push(`t.witness_id IN (${witnesses.map(() => "?").join(",")})`);
        params.push(...witnesses);
      }

      if (tokenType === "standalone") {
        clauses.push("t.compound_id IS NULL");
      } else if (tokenType === "compound-part") {
        clauses.push("t.compound_id IS NOT NULL");
      } else if (tokenType === "compound") {
        clauses.push("t.compound_id IS NULL");
      }

      if (clauses.length > 0) {
        sql += ` WHERE ${clauses.join(" AND ")}`;
      }

      tokens = await db.query(sql, params);
    }

    if (lemmas.length > 0 && classifier) {
      tokens = tokens.filter((token) => lemmas.includes(Number(token.lemma_id)));
    }

    if (regexPattern) {
      let regex: RegExp;
      try {
        regex = new RegExp(regexPattern, "i");
      } catch (error) {
        db.close();
        return res.status(400).json({ error: "Invalid regex pattern" });
      }
      tokens = tokens.filter((token) => regex.test(String(token.mdc || "")));
    }

    const total = tokens.length;
    const paged = tokens.slice(offset, offset + limit);
    db.close();

    res.json({
      items: paged.map(mapToken),
      total,
    });
  } catch (error) {
    console.error("Error running query:", error);
    res.status(500).json({ error: "Failed to run query" });
  }
});

/**
 * Get all data for a project (lemmas, tokens, witnesses, classifiers)
 * Useful for complete data loading
 * GET /api/iclassifier/:projectId/full
 */
router.get("/:projectId/full", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);

    // Fetch all data
    const lemmas = await db.getLemmas();
    const tokens = await db.getTokens();
    const witnesses = await db.getWitnesses();
    const classifiers = await db.getClassifierMetadata();
    const classifierMeanings = await db.getClassifierMeanings();

    db.close();

    // Transform lemmas
    const lemmaMap: Record<number, any> = {};
    (lemmas as any[]).forEach((lemma) => {
      lemmaMap[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || "",
      };
    });

    // Transform tokens
    const tokenMap: Record<number, any> = {};
    (tokens as any[]).forEach((token) => {
      tokenMap[token.id] = mapToken(token);
    });

    // Transform witnesses
    const witnessMap: Record<string, any> = {};
    (witnesses as any[]).forEach((witness) => {
      witnessMap[witness.id] = {
        id: witness.id,
        name: witness.name,
        script: witness.script,
        genre: witness.genre,
        object_type: witness.object_type,
        location: witness.location,
        period_date_start: witness.period_date_start,
        period_date_end: witness.period_date_end,
        chrono_date_start: witness.chrono_date_start,
        chrono_date_end: witness.chrono_date_end,
        url: witness.url,
        comments: witness.comments,
        supertext_id: witness.supertext_id,
      };
    });

    res.json({
      lemmas: lemmaMap,
      tokens: tokenMap,
      witnesses: witnessMap,
      classifiers: classifiers,
      classifierMeanings: classifierMeanings,
    });
  } catch (error) {
    console.error("Error fetching full project data:", error);
    res.status(500).json({ error: "Failed to fetch project data" });
  }
});

/**
 * Get list of available projects by scanning data/projects folder
 * GET /api/iclassifier/projects/list
 */
router.get("/projects/list", async (req: Request, res: Response) => {
  try {
    const dbPath = resolveDatabaseDir();
    console.log(`[API] projects/list using dbPath: ${dbPath}`);
    console.log(`[API] cwd: ${process.cwd()}`);

    if (!fs.existsSync(dbPath)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(dbPath);
    const dbFiles = files.filter((file) => {
      if (!file.endsWith(".db")) return false;
      const fullPath = path.join(dbPath, file);
      try {
        return fs.statSync(fullPath).size > 0;
      } catch {
        return false;
      }
    });
    const projects = dbFiles.map((f) => f.replace(".db", ""));

    res.json(projects);
  } catch (error) {
    console.error("Error listing projects:", error);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

export default router;

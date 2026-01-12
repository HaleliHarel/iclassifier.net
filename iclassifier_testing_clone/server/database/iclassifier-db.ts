import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let SQL: any = null;
const EMPTY_DB_SIZE_BYTES = 0;

const isDirectory = (candidate: string) => {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
};

const normalizeCandidateDir = (candidate?: string | null) => {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  try {
    const stats = fs.statSync(resolved);
    if (stats.isFile()) {
      return path.dirname(resolved);
    }
  } catch {
    // Ignore missing paths; keep resolved for later checks.
  }
  return resolved;
};

export function resolveDatabaseDir(): string {
  const candidates = [
    normalizeCandidateDir(process.env.ICLASSIFIER_DATA_PATH),
    path.join(process.cwd(), "databases"),
    path.join(process.cwd(), "data", "projects"),
    path.join(process.cwd(), "..", "iclassifier", "databases"),
    path.join(process.cwd(), "..", "iclassifier", "data", "projects"),
    path.join(process.cwd(), "iclassifier_testing_clone", "data", "projects"),
    path.join(__dirname, "..", "..", "data", "projects"),
  ].filter(Boolean) as string[];

  const hasNonEmptyDb = (candidate: string) => {
    if (!fs.existsSync(candidate) || !isDirectory(candidate)) return false;
    const files = fs.readdirSync(candidate);
    return files.some((file) => {
      if (!file.endsWith(".db")) return false;
      const fullPath = path.join(candidate, file);
      try {
        return fs.statSync(fullPath).size > EMPTY_DB_SIZE_BYTES;
      } catch {
        return false;
      }
    });
  };

  for (const candidate of candidates) {
    if (hasNonEmptyDb(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && isDirectory(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), "data", "projects");
}

export function resolveDatabasePath(projectId: string): string {
  const candidates = [
    normalizeCandidateDir(process.env.ICLASSIFIER_DATA_PATH),
    path.join(process.cwd(), "databases"),
    path.join(process.cwd(), "data", "projects"),
    path.join(process.cwd(), "..", "iclassifier", "databases"),
    path.join(process.cwd(), "..", "iclassifier", "data", "projects"),
    path.join(process.cwd(), "iclassifier_testing_clone", "data", "projects"),
    path.join(__dirname, "..", "..", "data", "projects"),
  ].filter(Boolean) as string[];

  for (const basePath of candidates) {
    const dbPath = path.join(basePath, `${projectId}.db`);
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    const stats = fs.statSync(dbPath);
    if (stats.size > EMPTY_DB_SIZE_BYTES) {
      return dbPath;
    }
  }

  return path.join(resolveDatabaseDir(), `${projectId}.db`);
}

/**
 * Initialize sql.js once
 */
async function initSQL() {
  if (SQL) return SQL;
  SQL = await initSqlJs();
  return SQL;
}

/**
 * SQLite database client for iClassifier projects
 * Uses sql.js (pure JavaScript implementation)
 * Each project has its own .db file
 */
export class iClassifierDB {
  private db: SqlJsDatabase | null = null;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  private tableExists(tableName: string): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    );
    stmt.bind([tableName]);
    const exists = stmt.step();
    stmt.free();
    return exists;
  }

  private getTableColumns(tableName: string): string[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
    const columns: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { name?: string };
      if (row?.name) columns.push(String(row.name));
    }
    stmt.free();
    return columns;
  }

  private getClassifierTableConfig(): {
    table: string | null;
    classifierColumn: string | null;
    tokenIdColumn: string | null;
  } {
    if (!this.db) {
      return { table: null, classifierColumn: null, tokenIdColumn: null };
    }
    const tableCandidates = ["classifier_metadata", "clf_parses"];
    for (const table of tableCandidates) {
      if (!this.tableExists(table)) continue;
      const columns = this.getTableColumns(table);
      const classifierColumn =
        columns.find((col) => ["clf", "gardiner_number", "classifier", "mdc"].includes(col)) ||
        null;
      const tokenIdColumn = columns.includes("token_id") ? "token_id" : null;
      if (classifierColumn && tokenIdColumn) {
        return { table, classifierColumn, tokenIdColumn };
      }
    }
    return { table: null, classifierColumn: null, tokenIdColumn: null };
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.db) return; // Already initialized

    try {
      const SQL = await initSQL();

      const dbPath = resolveDatabasePath(this.projectId);

      console.log(`[DB] Loading database: ${dbPath}`);

      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found: ${dbPath}`);
      }

      const fileBuffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(fileBuffer);

      console.log(`[DB] Successfully loaded: ${this.projectId}`);
    } catch (error) {
      console.error(
        `[DB] Error initializing database for ${this.projectId}:`,
        error
      );
      throw error;
    }
  }

  async getLemmasPaged(
    search: string,
    limit: number,
    offset: number,
    withCounts: boolean
  ): Promise<{ items: any[]; total: number }> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const whereClauses: string[] = [];
      const params: any[] = [];
      if (search) {
        const like = `%${search}%`;
        whereClauses.push(
          "(l.transliteration LIKE ? OR l.meaning LIKE ? OR CAST(l.id AS TEXT) LIKE ?)"
        );
        params.push(like, like, like);
      }
      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countStmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM lemmas l ${whereSql}`
      );
      countStmt.bind(params);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject() as { total?: number };
        total = Number(row?.total || 0);
      }
      countStmt.free();

      const result: any[] = [];
      if (withCounts) {
        const stmt = this.db.prepare(
          `SELECT l.*, COUNT(t.id) as token_count
           FROM lemmas l
           LEFT JOIN tokens t ON t.lemma_id = l.id
           ${whereSql}
           GROUP BY l.id
           ORDER BY token_count DESC, l.id ASC
           LIMIT ? OFFSET ?`
        );
        stmt.bind([...params, limit, offset]);
        while (stmt.step()) {
          result.push(stmt.getAsObject());
        }
        stmt.free();
      } else {
        const stmt = this.db.prepare(
          `SELECT l.*
           FROM lemmas l
           ${whereSql}
           ORDER BY l.id ASC
           LIMIT ? OFFSET ?`
        );
        stmt.bind([...params, limit, offset]);
        while (stmt.step()) {
          result.push(stmt.getAsObject());
        }
        stmt.free();
      }

      return { items: result, total };
    } catch (error) {
      console.error("Error fetching paged lemmas:", error);
      return { items: [], total: 0 };
    }
  }

  async getWitnessesPaged(
    search: string,
    limit: number,
    offset: number
  ): Promise<{ items: any[]; total: number }> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const whereClauses: string[] = [];
      const params: any[] = [];
      if (search) {
        const like = `%${search}%`;
        whereClauses.push(
          "(id LIKE ? OR name LIKE ? OR script LIKE ?)"
        );
        params.push(like, like, like);
      }
      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countStmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM witnesses ${whereSql}`
      );
      countStmt.bind(params);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject() as { total?: number };
        total = Number(row?.total || 0);
      }
      countStmt.free();

      const stmt = this.db.prepare(
        `SELECT *
         FROM witnesses
         ${whereSql}
         ORDER BY name ASC, id ASC
         LIMIT ? OFFSET ?`
      );
      stmt.bind([...params, limit, offset]);
      const items: any[] = [];
      while (stmt.step()) {
        items.push(stmt.getAsObject());
      }
      stmt.free();

      return { items, total };
    } catch (error) {
      console.error("Error fetching paged witnesses:", error);
      return { items: [], total: 0 };
    }
  }

  async getScripts(): Promise<string[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const stmt = this.db.prepare(
        "SELECT DISTINCT script FROM witnesses WHERE script IS NOT NULL AND script != '' ORDER BY script"
      );
      const result: string[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as { script?: string };
        if (row?.script) result.push(String(row.script));
      }
      stmt.free();
      return result;
    } catch (error) {
      console.error("Error fetching scripts:", error);
      return [];
    }
  }

  async getClassifierValuesPaged(
    search: string,
    limit: number,
    offset: number
  ): Promise<{ items: string[]; total: number }> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const config = this.getClassifierTableConfig();
      if (!config.table || !config.classifierColumn) {
        return { items: [], total: 0 };
      }

      const whereClauses: string[] = [];
      const params: any[] = [];
      if (search) {
        const like = `%${search}%`;
        whereClauses.push(`${config.classifierColumn} LIKE ?`);
        params.push(like);
      }
      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countStmt = this.db.prepare(
        `SELECT COUNT(DISTINCT ${config.classifierColumn}) as total FROM ${config.table} ${whereSql}`
      );
      countStmt.bind(params);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject() as { total?: number };
        total = Number(row?.total || 0);
      }
      countStmt.free();

      const stmt = this.db.prepare(
        `SELECT DISTINCT ${config.classifierColumn} as classifier
         FROM ${config.table}
         ${whereSql}
         ORDER BY ${config.classifierColumn} ASC
         LIMIT ? OFFSET ?`
      );
      stmt.bind([...params, limit, offset]);
      const items: string[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as { classifier?: string };
        if (row?.classifier) items.push(String(row.classifier));
      }
      stmt.free();

      return { items, total };
    } catch (error) {
      console.error("Error fetching classifier values:", error);
      return { items: [], total: 0 };
    }
  }

  async getTokensByLemma(
    lemmaId: number,
    options: {
      witnessIds?: string[];
      scripts?: string[];
      tokenType?: "all" | "standalone" | "compound" | "compound-part";
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: any[]; total: number }> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const clauses: string[] = ["t.lemma_id = ?"];
      const params: any[] = [lemmaId];
      let joinSql = "";

      if (options.witnessIds && options.witnessIds.length > 0) {
        clauses.push(`t.witness_id IN (${options.witnessIds.map(() => "?").join(",")})`);
        params.push(...options.witnessIds);
      }

      if (options.scripts && options.scripts.length > 0) {
        joinSql = "LEFT JOIN witnesses w ON w.id = t.witness_id";
        clauses.push(`w.script IN (${options.scripts.map(() => "?").join(",")})`);
        params.push(...options.scripts);
      }

      if (options.tokenType === "standalone") {
        clauses.push("t.compound_id IS NULL");
      } else if (options.tokenType === "compound-part") {
        clauses.push("t.compound_id IS NOT NULL");
      } else if (options.tokenType === "compound") {
        clauses.push("t.compound_id IS NULL");
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const countStmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM tokens t ${joinSql} ${whereSql}`
      );
      countStmt.bind(params);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject() as { total?: number };
        total = Number(row?.total || 0);
      }
      countStmt.free();

      const limit = typeof options.limit === "number" ? options.limit : total;
      const offset = typeof options.offset === "number" ? options.offset : 0;

      const stmt = this.db.prepare(
        `SELECT t.* FROM tokens t ${joinSql} ${whereSql} ORDER BY t.id ASC LIMIT ? OFFSET ?`
      );
      stmt.bind([...params, limit, offset]);
      const items: any[] = [];
      while (stmt.step()) {
        items.push(stmt.getAsObject());
      }
      stmt.free();

      return { items, total };
    } catch (error) {
      console.error("Error fetching tokens by lemma:", error);
      return { items: [], total: 0 };
    }
  }

  async getTokensByClassifier(
    classifier: string,
    options: {
      witnessIds?: string[];
      scripts?: string[];
      tokenType?: "all" | "standalone" | "compound" | "compound-part";
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: any[]; total: number }> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const config = this.getClassifierTableConfig();
      if (!config.table || !config.classifierColumn || !config.tokenIdColumn) {
        const clauses: string[] = ["t.mdc_w_markup LIKE ?"];
        const params: any[] = [`%~${classifier}~%`];
        let joinSql = "";

        if (options.witnessIds && options.witnessIds.length > 0) {
          clauses.push(`t.witness_id IN (${options.witnessIds.map(() => "?").join(",")})`);
          params.push(...options.witnessIds);
        }

        if (options.scripts && options.scripts.length > 0) {
          joinSql = "LEFT JOIN witnesses w ON w.id = t.witness_id";
          clauses.push(`w.script IN (${options.scripts.map(() => "?").join(",")})`);
          params.push(...options.scripts);
        }

        if (options.tokenType === "standalone") {
          clauses.push("t.compound_id IS NULL");
        } else if (options.tokenType === "compound-part") {
          clauses.push("t.compound_id IS NOT NULL");
        } else if (options.tokenType === "compound") {
          clauses.push("t.compound_id IS NULL");
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

        const countStmt = this.db.prepare(
          `SELECT COUNT(DISTINCT t.id) as total
           FROM tokens t
           ${joinSql}
           ${whereSql}`
        );
        countStmt.bind(params);
        let total = 0;
        if (countStmt.step()) {
          const row = countStmt.getAsObject() as { total?: number };
          total = Number(row?.total || 0);
        }
        countStmt.free();

        const limit = typeof options.limit === "number" ? options.limit : total;
        const offset = typeof options.offset === "number" ? options.offset : 0;

        const stmt = this.db.prepare(
          `SELECT DISTINCT t.*
           FROM tokens t
           ${joinSql}
           ${whereSql}
           ORDER BY t.id ASC
           LIMIT ? OFFSET ?`
        );
        stmt.bind([...params, limit, offset]);
        const items: any[] = [];
        while (stmt.step()) {
          items.push(stmt.getAsObject());
        }
        stmt.free();

        return { items, total };
      }

      const clauses: string[] = [`c.${config.classifierColumn} = ?`];
      const params: any[] = [classifier];
      let joinSql = "";

      if (options.witnessIds && options.witnessIds.length > 0) {
        clauses.push(`t.witness_id IN (${options.witnessIds.map(() => "?").join(",")})`);
        params.push(...options.witnessIds);
      }

      if (options.scripts && options.scripts.length > 0) {
        joinSql = "LEFT JOIN witnesses w ON w.id = t.witness_id";
        clauses.push(`w.script IN (${options.scripts.map(() => "?").join(",")})`);
        params.push(...options.scripts);
      }

      if (options.tokenType === "standalone") {
        clauses.push("t.compound_id IS NULL");
      } else if (options.tokenType === "compound-part") {
        clauses.push("t.compound_id IS NOT NULL");
      } else if (options.tokenType === "compound") {
        clauses.push("t.compound_id IS NULL");
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const countStmt = this.db.prepare(
        `SELECT COUNT(DISTINCT t.id) as total
         FROM tokens t
         JOIN ${config.table} c ON c.${config.tokenIdColumn} = t.id
         ${joinSql}
         ${whereSql}`
      );
      countStmt.bind(params);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject() as { total?: number };
        total = Number(row?.total || 0);
      }
      countStmt.free();

      const limit = typeof options.limit === "number" ? options.limit : total;
      const offset = typeof options.offset === "number" ? options.offset : 0;

      const stmt = this.db.prepare(
        `SELECT DISTINCT t.*
         FROM tokens t
         JOIN ${config.table} c ON c.${config.tokenIdColumn} = t.id
         ${joinSql}
         ${whereSql}
         ORDER BY t.id ASC
         LIMIT ? OFFSET ?`
      );
      stmt.bind([...params, limit, offset]);
      const items: any[] = [];
      while (stmt.step()) {
        items.push(stmt.getAsObject());
      }
      stmt.free();

      return { items, total };
    } catch (error) {
      console.error("Error fetching tokens by classifier:", error);
      return { items: [], total: 0 };
    }
  }

  async getTokensByIds(ids: number[]): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      if (ids.length === 0) return [];

      const placeholders = ids.map(() => "?").join(",");
      const stmt = this.db.prepare(
        `SELECT * FROM tokens WHERE id IN (${placeholders}) ORDER BY id ASC`
      );
      stmt.bind(ids);
      const items: any[] = [];
      while (stmt.step()) {
        items.push(stmt.getAsObject());
      }
      stmt.free();
      return items;
    } catch (error) {
      console.error("Error fetching tokens by ids:", error);
      return [];
    }
  }

  /**
   * Get all lemmas for the project
   */
  async getLemmas(): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      console.log(`[DB] Fetching lemmas for ${this.projectId}`);
      
      const stmt = this.db.prepare("SELECT * FROM lemmas");
      const result = [];
      
      try {
        while (stmt.step()) {
          result.push(stmt.getAsObject());
        }
      } finally {
        stmt.free();
      }

      console.log(`[DB] Found ${result.length} lemmas for ${this.projectId}`);
      return result;
    } catch (error) {
      console.error(`[DB] Error fetching lemmas for ${this.projectId}:`, error);
      return [];
    }
  }

  /**
   * Get a specific lemma by ID
   */
  async getLemmaById(lemmaId: number): Promise<any> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare("SELECT * FROM lemmas WHERE id = ?");
      stmt.bind([lemmaId]);

      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }

      stmt.free();
      return null;
    } catch (error) {
      console.error("Error fetching lemma:", error);
      return null;
    }
  }

  /**
   * Get all tokens
   */
  async getTokens(): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare("SELECT * FROM tokens");
      const result = [];

      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      stmt.free();

      return result;
    } catch (error) {
      console.error("Error fetching tokens:", error);
      return [];
    }
  }

  /**
   * Get all witnesses
   */
  async getWitnesses(): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare("SELECT * FROM witnesses");
      const result = [];

      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      stmt.free();

      return result;
    } catch (error) {
      console.error("Error fetching witnesses:", error);
      return [];
    }
  }

  /**
   * Get all classifiers metadata
   * Note: This table may not exist in all databases
   */
  async getClassifierMetadata(): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const classifierMetadata = await this.getTableData("classifier_metadata");
      if (classifierMetadata.length > 0) {
        return classifierMetadata;
      }

      const clfParses = await this.getTableData("clf_parses");
      if (clfParses.length > 0) {
        return clfParses;
      }

      console.log(
        `[DB] classifier_metadata and clf_parses tables not found in ${this.projectId}, returning empty array`
      );
      return [];
    } catch (error) {
      console.error("Error fetching classifier metadata:", error);
      return [];
    }
  }

  /**
   * Get classifier meanings (if available)
   */
  async getClassifierMeanings(): Promise<Record<string, string>> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const rows = await this.getTableData("clf_meanings");
      if (rows.length === 0) {
        return {};
      }

      const meaningMap = new Map<string, Set<string>>();
      rows.forEach((row) => {
        const classifier = row.clf || row.gardiner_number || row.classifier || row.mdc;
        const meaning = row.meaning || row.clf_meaning || row.gloss;
        if (!classifier || !meaning) return;
        const key = String(classifier);
        if (!meaningMap.has(key)) {
          meaningMap.set(key, new Set());
        }
        meaningMap.get(key)!.add(String(meaning).trim());
      });

      const result: Record<string, string> = {};
      meaningMap.forEach((meanings, classifier) => {
        const normalized = Array.from(meanings).filter(Boolean);
        if (normalized.length > 0) {
          result[classifier] = normalized.join("; ");
        }
      });

      return result;
    } catch (error) {
      console.error("Error fetching classifier meanings:", error);
      return {};
    }
  }

  /**
   * Get classifier metadata for a specific token
   * Note: This table may not exist in all databases
   */
  async getTokenClassifiers(tokenId: number): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const classifierMetadata = await this.getTableData("classifier_metadata", tokenId);
      if (classifierMetadata.length > 0) {
        return classifierMetadata;
      }

      const clfParses = await this.getTableData("clf_parses", tokenId);
      if (clfParses.length > 0) {
        return clfParses;
      }

      return [];
    } catch (error) {
      console.error("Error fetching token classifiers:", error);
      return [];
    }
  }

  /**
   * Run a custom query (for advanced queries)
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }

      const result = [];
      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      stmt.free();

      return result;
    } catch (error) {
      console.error("Error running query:", error);
      return [];
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async getTableData(tableName: string, tokenId?: number): Promise<any[]> {
    if (!this.db) return [];

    const tableCheck = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='${tableName}'
    `);

    if (!tableCheck.step()) {
      tableCheck.free();
      return [];
    }
    tableCheck.free();

    const stmt = tokenId
      ? this.db.prepare(`SELECT * FROM ${tableName} WHERE token_id = ?`)
      : this.db.prepare(`SELECT * FROM ${tableName}`);

    if (tokenId) {
      stmt.bind([tokenId]);
    }

    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();

    return result;
  }
}

/**
 * Get database instance for a project
 * Remember to close it when done
 */
export function getProjectDB(projectId: string): iClassifierDB {
  return new iClassifierDB(projectId);
}

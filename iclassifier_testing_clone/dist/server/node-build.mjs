import path from "path";
import "dotenv/config";
import * as express from "express";
import express__default, { Router } from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import initSqlJs from "sql.js";
import fs from "fs";
import { fileURLToPath } from "url";
const handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};
const createTransporter = () => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.warn(
      "Gmail credentials not configured. Bug reports will be logged but not emailed."
    );
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
};
async function handleBugReport(req, res) {
  try {
    const { title, description, email, severity, image } = req.body;
    if (!title || !description || !email || !severity) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }
    console.log("Bug Report Received:", {
      title,
      description,
      email,
      severity,
      hasImage: !!image,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const attachments = [];
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      attachments.push({
        filename: `bug-report-screenshot-${Date.now()}.png`,
        content: Buffer.from(base64Data, "base64"),
        contentType: "image/png"
      });
    }
    const transporter = createTransporter();
    if (transporter) {
      try {
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: "iclassifierteam@gmail.com",
          subject: `[${severity.toUpperCase()}] Bug Report: ${title}`,
          html: `
            <h2>New Bug Report</h2>
            <p><strong>Severity Level:</strong> <span style="color: ${severity === "high" ? "red" : severity === "medium" ? "orange" : "green"}; font-weight: bold;">${severity.toUpperCase()}</span></p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Reporter Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <hr style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="white-space: pre-wrap;">${description.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            <hr style="margin: 20px 0;">
            <p><small>Submitted on: ${(/* @__PURE__ */ new Date()).toISOString()}</small></p>
            ${image ? "<p><small>Screenshot attached</small></p>" : ""}
          `,
          attachments
        };
        await transporter.sendMail(mailOptions);
        console.log("Bug report email sent successfully");
      } catch (emailError) {
        console.error("Error sending bug report email:", emailError);
      }
    }
    res.json({
      success: true,
      message: "Bug report submitted successfully"
    });
  } catch (error) {
    console.error("Error processing bug report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bug report"
    });
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let SQL = null;
const EMPTY_DB_SIZE_BYTES = 0;
const isDirectory = (candidate) => {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
};
const normalizeCandidateDir = (candidate) => {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  try {
    const stats = fs.statSync(resolved);
    if (stats.isFile()) {
      return path.dirname(resolved);
    }
  } catch {
  }
  return resolved;
};
function resolveDatabaseDir() {
  const candidates = [
    normalizeCandidateDir(process.env.ICLASSIFIER_DATA_PATH),
    path.join(process.cwd(), "databases"),
    path.join(process.cwd(), "data", "projects"),
    path.join(process.cwd(), "..", "iclassifier", "databases"),
    path.join(process.cwd(), "..", "iclassifier", "data", "projects"),
    path.join(process.cwd(), "iclassifier_testing_clone", "data", "projects"),
    path.join(__dirname$1, "..", "..", "data", "projects")
  ].filter(Boolean);
  const hasNonEmptyDb = (candidate) => {
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
function resolveDatabasePath(projectId) {
  const candidates = [
    normalizeCandidateDir(process.env.ICLASSIFIER_DATA_PATH),
    path.join(process.cwd(), "databases"),
    path.join(process.cwd(), "data", "projects"),
    path.join(process.cwd(), "..", "iclassifier", "databases"),
    path.join(process.cwd(), "..", "iclassifier", "data", "projects"),
    path.join(process.cwd(), "iclassifier_testing_clone", "data", "projects"),
    path.join(__dirname$1, "..", "..", "data", "projects")
  ].filter(Boolean);
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
async function initSQL() {
  if (SQL) return SQL;
  SQL = await initSqlJs();
  return SQL;
}
class iClassifierDB {
  db = null;
  projectId;
  constructor(projectId) {
    this.projectId = projectId;
  }
  tableExists(tableName) {
    if (!this.db) return false;
    const stmt = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    );
    stmt.bind([tableName]);
    const exists = stmt.step();
    stmt.free();
    return exists;
  }
  getTableColumns(tableName) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
    const columns = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row?.name) columns.push(String(row.name));
    }
    stmt.free();
    return columns;
  }
  getClassifierTableConfig() {
    if (!this.db) {
      return { table: null, classifierColumn: null, tokenIdColumn: null };
    }
    const tableCandidates = ["classifier_metadata", "clf_parses"];
    for (const table of tableCandidates) {
      if (!this.tableExists(table)) continue;
      const columns = this.getTableColumns(table);
      const classifierColumn = columns.find((col) => ["clf", "gardiner_number", "classifier", "mdc"].includes(col)) || null;
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
  async initialize() {
    if (this.db) return;
    try {
      const SQL2 = await initSQL();
      const dbPath = resolveDatabasePath(this.projectId);
      console.log(`[DB] Loading database: ${dbPath}`);
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found: ${dbPath}`);
      }
      const fileBuffer = fs.readFileSync(dbPath);
      this.db = new SQL2.Database(fileBuffer);
      console.log(`[DB] Successfully loaded: ${this.projectId}`);
    } catch (error) {
      console.error(
        `[DB] Error initializing database for ${this.projectId}:`,
        error
      );
      throw error;
    }
  }
  async getLemmasPaged(search, limit, offset, withCounts) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const whereClauses = [];
      const params = [];
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
        const row = countStmt.getAsObject();
        total = Number(row?.total || 0);
      }
      countStmt.free();
      const result = [];
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
  async getWitnessesPaged(search, limit, offset) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const whereClauses = [];
      const params = [];
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
        const row = countStmt.getAsObject();
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
      const items = [];
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
  async getScripts() {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const stmt = this.db.prepare(
        "SELECT DISTINCT script FROM witnesses WHERE script IS NOT NULL AND script != '' ORDER BY script"
      );
      const result = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row?.script) result.push(String(row.script));
      }
      stmt.free();
      return result;
    } catch (error) {
      console.error("Error fetching scripts:", error);
      return [];
    }
  }
  async getClassifierValuesPaged(search, limit, offset) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const config = this.getClassifierTableConfig();
      if (!config.table || !config.classifierColumn) {
        return { items: [], total: 0 };
      }
      const whereClauses = [];
      const params = [];
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
        const row = countStmt.getAsObject();
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
      const items = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row?.classifier) items.push(String(row.classifier));
      }
      stmt.free();
      return { items, total };
    } catch (error) {
      console.error("Error fetching classifier values:", error);
      return { items: [], total: 0 };
    }
  }
  async getTokensByLemma(lemmaId, options) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const clauses = ["t.lemma_id = ?"];
      const params = [lemmaId];
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
        const row = countStmt.getAsObject();
        total = Number(row?.total || 0);
      }
      countStmt.free();
      const limit = typeof options.limit === "number" ? options.limit : total;
      const offset = typeof options.offset === "number" ? options.offset : 0;
      const stmt = this.db.prepare(
        `SELECT t.* FROM tokens t ${joinSql} ${whereSql} ORDER BY t.id ASC LIMIT ? OFFSET ?`
      );
      stmt.bind([...params, limit, offset]);
      const items = [];
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
  async getTokensByClassifier(classifier, options) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const config = this.getClassifierTableConfig();
      if (!config.table || !config.classifierColumn || !config.tokenIdColumn) {
        const clauses2 = ["t.mdc_w_markup LIKE ?"];
        const params2 = [`%~${classifier}~%`];
        let joinSql2 = "";
        if (options.witnessIds && options.witnessIds.length > 0) {
          clauses2.push(`t.witness_id IN (${options.witnessIds.map(() => "?").join(",")})`);
          params2.push(...options.witnessIds);
        }
        if (options.scripts && options.scripts.length > 0) {
          joinSql2 = "LEFT JOIN witnesses w ON w.id = t.witness_id";
          clauses2.push(`w.script IN (${options.scripts.map(() => "?").join(",")})`);
          params2.push(...options.scripts);
        }
        if (options.tokenType === "standalone") {
          clauses2.push("t.compound_id IS NULL");
        } else if (options.tokenType === "compound-part") {
          clauses2.push("t.compound_id IS NOT NULL");
        } else if (options.tokenType === "compound") {
          clauses2.push("t.compound_id IS NULL");
        }
        const whereSql2 = clauses2.length ? `WHERE ${clauses2.join(" AND ")}` : "";
        const countStmt2 = this.db.prepare(
          `SELECT COUNT(DISTINCT t.id) as total
           FROM tokens t
           ${joinSql2}
           ${whereSql2}`
        );
        countStmt2.bind(params2);
        let total2 = 0;
        if (countStmt2.step()) {
          const row = countStmt2.getAsObject();
          total2 = Number(row?.total || 0);
        }
        countStmt2.free();
        const limit2 = typeof options.limit === "number" ? options.limit : total2;
        const offset2 = typeof options.offset === "number" ? options.offset : 0;
        const stmt2 = this.db.prepare(
          `SELECT DISTINCT t.*
           FROM tokens t
           ${joinSql2}
           ${whereSql2}
           ORDER BY t.id ASC
           LIMIT ? OFFSET ?`
        );
        stmt2.bind([...params2, limit2, offset2]);
        const items2 = [];
        while (stmt2.step()) {
          items2.push(stmt2.getAsObject());
        }
        stmt2.free();
        return { items: items2, total: total2 };
      }
      const clauses = [`c.${config.classifierColumn} = ?`];
      const params = [classifier];
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
        const row = countStmt.getAsObject();
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
      const items = [];
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
  async getTokensByIds(ids) {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(",");
      const stmt = this.db.prepare(
        `SELECT * FROM tokens WHERE id IN (${placeholders}) ORDER BY id ASC`
      );
      stmt.bind(ids);
      const items = [];
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
  async getLemmas() {
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
  async getLemmaById(lemmaId) {
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
  async getTokens() {
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
  async getWitnesses() {
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
  async getClassifierMetadata() {
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
  async getClassifierMeanings() {
    try {
      await this.initialize();
      if (!this.db) throw new Error("Database not initialized");
      const rows = await this.getTableData("clf_meanings");
      if (rows.length === 0) {
        return {};
      }
      const meaningMap = /* @__PURE__ */ new Map();
      rows.forEach((row) => {
        const classifier = row.clf || row.gardiner_number || row.classifier || row.mdc;
        const meaning = row.meaning || row.clf_meaning || row.gloss;
        if (!classifier || !meaning) return;
        const key = String(classifier);
        if (!meaningMap.has(key)) {
          meaningMap.set(key, /* @__PURE__ */ new Set());
        }
        meaningMap.get(key).add(String(meaning).trim());
      });
      const result = {};
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
  async getTokenClassifiers(tokenId) {
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
  async query(sql, params = []) {
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
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  async getTableData(tableName, tokenId) {
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
    const stmt = tokenId ? this.db.prepare(`SELECT * FROM ${tableName} WHERE token_id = ?`) : this.db.prepare(`SELECT * FROM ${tableName}`);
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
function getProjectDB(projectId) {
  return new iClassifierDB(projectId);
}
const router$2 = Router();
const toNumber = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const mapToken = (token) => ({
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
  pos: token.pos
});
router$2.get("/test", (req, res) => {
  console.log("[API] Test endpoint hit");
  res.json({ status: "API working", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
router$2.get("/:projectId/lemmas", async (req, res) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const lemmas = await db.getLemmas();
    db.close();
    const lemmaMap = {};
    lemmas.forEach((lemma) => {
      lemmaMap[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || ""
      };
    });
    res.json(lemmaMap);
  } catch (error) {
    console.error("Error fetching lemmas:", error);
    res.status(500).json({ error: "Failed to fetch lemmas" });
  }
});
router$2.get("/:projectId/lemmas/paged", async (req, res) => {
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
      token_count: lemma.token_count ?? 0
    }));
    res.json({ items: lemmas, total });
  } catch (error) {
    console.error("Error fetching paged lemmas:", error);
    res.status(500).json({ error: "Failed to fetch lemmas" });
  }
});
router$2.get("/:projectId/tokens", async (req, res) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const tokens = await db.getTokens();
    db.close();
    const tokenMap = {};
    tokens.forEach((token) => {
      tokenMap[token.id] = mapToken(token);
    });
    res.json(tokenMap);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});
router$2.get("/:projectId/tokens/by-lemma/:lemmaId", async (req, res) => {
  const { projectId, lemmaId } = req.params;
  const limit = toNumber(req.query.limit, 200);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = req.query.tokenType || "all";
  const witnesses = String(req.query.witnesses || "").split(",").map((value) => value.trim()).filter(Boolean);
  const scripts = String(req.query.scripts || "").split(",").map((value) => value.trim()).filter(Boolean);
  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getTokensByLemma(Number(lemmaId), {
      witnessIds: witnesses,
      scripts,
      tokenType,
      limit,
      offset
    });
    db.close();
    res.json({
      items: items.map(mapToken),
      total
    });
  } catch (error) {
    console.error("Error fetching tokens by lemma:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});
router$2.get("/:projectId/tokens/by-classifier/:classifier", async (req, res) => {
  const { projectId, classifier } = req.params;
  const limit = toNumber(req.query.limit, 200);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = req.query.tokenType || "all";
  const witnesses = String(req.query.witnesses || "").split(",").map((value) => value.trim()).filter(Boolean);
  const scripts = String(req.query.scripts || "").split(",").map((value) => value.trim()).filter(Boolean);
  try {
    const db = getProjectDB(projectId);
    const { items, total } = await db.getTokensByClassifier(String(classifier), {
      witnessIds: witnesses,
      scripts,
      tokenType,
      limit,
      offset
    });
    db.close();
    res.json({
      items: items.map(mapToken),
      total
    });
  } catch (error) {
    console.error("Error fetching tokens by classifier:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});
router$2.get("/:projectId/tokens/by-ids", async (req, res) => {
  const { projectId } = req.params;
  const ids = String(req.query.ids || "").split(",").map((value) => parseInt(value.trim(), 10)).filter((value) => Number.isFinite(value));
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
router$2.get("/:projectId/witnesses", async (req, res) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const witnesses = await db.getWitnesses();
    db.close();
    const witnessMap = {};
    witnesses.forEach((witness) => {
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
        supertext_id: witness.supertext_id
      };
    });
    res.json(witnessMap);
  } catch (error) {
    console.error("Error fetching witnesses:", error);
    res.status(500).json({ error: "Failed to fetch witnesses" });
  }
});
router$2.get("/:projectId/witnesses/paged", async (req, res) => {
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
      supertext_id: witness.supertext_id
    }));
    res.json({ items: witnesses, total });
  } catch (error) {
    console.error("Error fetching paged witnesses:", error);
    res.status(500).json({ error: "Failed to fetch witnesses" });
  }
});
router$2.get("/:projectId/scripts", async (req, res) => {
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
router$2.get("/:projectId/classifiers", async (req, res) => {
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
router$2.get(
  "/:projectId/classifier-metadata",
  async (req, res) => {
    const { projectId } = req.params;
    try {
      const db = getProjectDB(projectId);
      const classifiers = await db.getClassifierMetadata();
      db.close();
      res.json(classifiers);
    } catch (error) {
      console.error("Error fetching classifier metadata:", error);
      res.status(500).json({ error: "Failed to fetch classifier metadata" });
    }
  }
);
router$2.get("/:projectId/classifier-meanings", async (req, res) => {
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
router$2.get("/:projectId/query", async (req, res) => {
  const { projectId } = req.params;
  const limit = toNumber(req.query.limit, 100);
  const offset = toNumber(req.query.offset, 0);
  const tokenType = req.query.tokenType || "all";
  const lemmas = String(req.query.lemmas || "").split(",").map((value) => value.trim()).filter(Boolean).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const witnesses = String(req.query.witnesses || "").split(",").map((value) => value.trim()).filter(Boolean);
  const scripts = String(req.query.scripts || "").split(",").map((value) => value.trim()).filter(Boolean);
  const classifier = String(req.query.classifier || "");
  const regexPattern = String(req.query.regex || "");
  try {
    const db = getProjectDB(projectId);
    let tokens = [];
    if (classifier) {
      const response = await db.getTokensByClassifier(classifier, {
        witnessIds: witnesses,
        scripts,
        tokenType
      });
      tokens = response.items;
    } else {
      let sql = "SELECT DISTINCT t.* FROM tokens t";
      const clauses = [];
      const params = [];
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
      let regex;
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
      total
    });
  } catch (error) {
    console.error("Error running query:", error);
    res.status(500).json({ error: "Failed to run query" });
  }
});
router$2.get("/:projectId/full", async (req, res) => {
  const { projectId } = req.params;
  try {
    const db = getProjectDB(projectId);
    const lemmas = await db.getLemmas();
    const tokens = await db.getTokens();
    const witnesses = await db.getWitnesses();
    const classifiers = await db.getClassifierMetadata();
    const classifierMeanings = await db.getClassifierMeanings();
    db.close();
    const lemmaMap = {};
    lemmas.forEach((lemma) => {
      lemmaMap[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || ""
      };
    });
    const tokenMap = {};
    tokens.forEach((token) => {
      tokenMap[token.id] = mapToken(token);
    });
    const witnessMap = {};
    witnesses.forEach((witness) => {
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
        supertext_id: witness.supertext_id
      };
    });
    res.json({
      lemmas: lemmaMap,
      tokens: tokenMap,
      witnesses: witnessMap,
      classifiers,
      classifierMeanings
    });
  } catch (error) {
    console.error("Error fetching full project data:", error);
    res.status(500).json({ error: "Failed to fetch project data" });
  }
});
router$2.get("/projects/list", async (req, res) => {
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
const router$1 = Router();
const JSESH_URL = process.env.JSESH_URL || "http://127.0.0.1:8080";
router$1.get("/:mdc", async (req, res) => {
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
    res.status(200).send("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
  }
});
const router = Router();
const DICTIONARY_URL = process.env.DICTIONARY_URL || "http://127.0.0.1:8090";
router.get("/:dictId/byid", async (req, res) => {
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
router.get("/:dictId/bysubstring", async (req, res) => {
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
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  app2.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app2.get("/api/demo", handleDemo);
  app2.post("/api/bug-report", handleBugReport);
  app2.use("/api/iclassifier", router$2);
  app2.use("/api/jsesh", router$1);
  app2.use("/api/dictionary", router);
  return app2;
}
const app = createServer();
const port = process.env.PORT || 3e3;
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map

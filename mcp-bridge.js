#!/usr/bin/env node

/**
 * AI Memory Bridge - MCP Server v0.2.0
 *
 * Reads memory index from Obsidian plugin, serves content directly from
 * vault .md files (always fresh). Includes TF-IDF semantic search,
 * wikilink extraction, and security validators.
 *
 * Usage:
 *   node mcp-bridge.js --vault "/path/to/obsidian/vault"
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ─── Configuration ───────────────────────────────────────────────────────────

const SERVER_NAME = "ai-memory-bridge";
const SERVER_VERSION = "0.2.0";
const MAX_FILE_SIZE = 512 * 1024; // 512KB max per file
const MAX_SEARCH_RESULTS = 50;
const MAX_SNIPPET_LEN = 120;

// Parse CLI args
let vaultPath = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--vault" && i + 1 < process.argv.length) {
    vaultPath = process.argv[++i];
  }
}

// ─── Security ────────────────────────────────────────────────────────────────

/**
 * Validate that a file path stays within the vault (prevent path traversal).
 */
function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  // Block path traversal attempts
  if (filePath.includes("..")) return false;
  if (filePath.includes("~")) return false;
  // Block absolute paths (only vault-relative paths allowed)
  if (path.isAbsolute(filePath)) return false;
  // Block null bytes and other dangerous characters
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(filePath)) return false;
  return true;
}

/**
 * Resolve a vault-relative path to an absolute filesystem path.
 */
function resolveVaultPath(relativePath) {
  if (!vaultPath) return null;
  if (!isPathSafe(relativePath)) return null;
  const resolved = path.resolve(vaultPath, relativePath);
  // Ensure resolved path is still inside vault
  if (!resolved.startsWith(path.resolve(vaultPath))) return null;
  return resolved;
}

// ─── Bridge File ─────────────────────────────────────────────────────────────

function getBridgeFilePath() {
  if (vaultPath) {
    return path.join(vaultPath, ".obsidian", "ai-memory-bridge", "memory-bridge.json");
  }
  return path.join(process.cwd(), ".obsidian", "ai-memory-bridge", "memory-bridge.json");
}

// Bridge index cache
let bridgeCache = null;
let bridgeCacheMtime = 0;

function readBridgeIndex() {
  const bridgeFile = getBridgeFilePath();
  if (!fs.existsSync(bridgeFile)) {
    bridgeCache = null;
    bridgeCacheMtime = 0;
    return { memories: [], vaultName: "unknown", memoryCount: 0 };
  }
  try {
    const stat = fs.statSync(bridgeFile);
    if (bridgeCache && bridgeCacheMtime === stat.mtimeMs) {
      return bridgeCache;
    }
    const raw = fs.readFileSync(bridgeFile, "utf-8");
    bridgeCache = JSON.parse(raw);
    bridgeCacheMtime = stat.mtimeMs;
    // Invalidate content cache when bridge changes
    invalidateContentCache();
    return bridgeCache;
  } catch (err) {
    bridgeCache = null;
    bridgeCacheMtime = 0;
    return { memories: [], vaultName: "unknown", memoryCount: 0, error: err.message };
  }
}

function invalidateBridgeCache() {
  bridgeCache = null;
  bridgeCacheMtime = 0;
}

// ─── Content Reading (Direct from .md files) ────────────────────────────────

// Content cache: path -> { content, mtime, wikilinks, frontmatter }
const contentCache = new Map();

function invalidateContentCache() {
  contentCache.clear();
}

/**
 * Read a single vault .md file (with mtime cache).
 * Returns null if file doesn't exist or is too large.
 */
function readVaultFile(relativePath) {
  const absPath = resolveVaultPath(relativePath);
  if (!absPath || !fs.existsSync(absPath)) return null;

  try {
    const stat = fs.statSync(absPath);
    // Size limit
    if (stat.size > MAX_FILE_SIZE) {
      return { content: `[文件过大: ${(stat.size / 1024).toFixed(0)}KB，超过 ${MAX_FILE_SIZE / 1024}KB 限制]`, wikilinks: [], frontmatter: {} };
    }

    const cached = contentCache.get(relativePath);
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached;
    }

    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = parseMarkdown(raw);
    const entry = { content: raw, mtime: stat.mtimeMs, wikilinks: parsed.wikilinks, frontmatter: parsed.frontmatter };
    contentCache.set(relativePath, entry);
    return entry;
  } catch (err) {
    return { content: `[读取错误: ${err.message}]`, wikilinks: [], frontmatter: {} };
  }
}

/**
 * Parse frontmatter and wikilinks from markdown content.
 */
function parseMarkdown(raw) {
  const result = { frontmatter: {}, wikilinks: [] };

  // Parse YAML frontmatter (between --- delimiters)
  if (raw.startsWith("---")) {
    const endIdx = raw.indexOf("---", 3);
    if (endIdx !== -1) {
      const fm = raw.slice(3, endIdx);
      for (const line of fm.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let value = line.slice(colonIdx + 1).trim();
          // Parse YAML list: [a, b, c]
          if (value.startsWith("[") && value.endsWith("]")) {
            value = value.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
            result.frontmatter[key] = value;
          } else {
            result.frontmatter[key] = value.replace(/^["']|["']$/g, "");
          }
        }
      }
    }
  }

  // Extract [[wikilinks]]
  const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  let match;
  while ((match = linkRegex.exec(raw)) !== null) {
    result.wikilinks.push(match[1].trim());
  }
  // Deduplicate
  result.wikilinks = [...new Set(result.wikilinks)];

  return result;
}

/**
 * Read all memory files live from the vault.
 */
function readAllMemoryFiles() {
  const index = readBridgeIndex();
  const results = [];
  for (const mem of index.memories || []) {
    const file = readVaultFile(mem.path);
    if (file) {
      results.push({
        path: mem.path,
        name: mem.name,
        content: file.content,
        wikilinks: file.wikilinks,
        frontmatter: file.frontmatter,
      });
    }
  }
  return results;
}

// ─── TF-IDF Search Engine ────────────────────────────────────────────────────

// TF-IDF index cache
let tfidfIndex = null;
let tfidfIndexMtime = 0;

/**
 * Simple CJK-aware tokenizer.
 * Splits on word boundaries for Latin text, keeps CJK bigrams.
 */
function tokenize(text) {
  const tokens = [];
  // Split into words + CJK characters
  const segments = text.toLowerCase().split(/[\s\n\r\t,./;:'"!?()\[\]{}<>|@#$%^&*+=~`-]+/);
  for (const seg of segments) {
    if (!seg) continue;
    // CJK bigram tokenization
    if (/[一-鿿぀-ゟ゠-ヿ]/.test(seg)) {
      for (let i = 0; i < seg.length; i++) {
        tokens.push(seg[i]); // Single char
        if (i + 1 < seg.length) {
          tokens.push(seg[i] + seg[i + 1]); // Bigram
        }
      }
    } else {
      // Latin word — keep as-is if meaningful length
      if (seg.length >= 2) tokens.push(seg);
    }
  }
  return tokens;
}

/**
 * Build or refresh the TF-IDF index over all memory files.
 */
function buildTFIDFIndex() {
  const files = readAllMemoryFiles();

  // Check if index is still fresh (based on bridge file mtime)
  const bridgeMtime = bridgeCacheMtime;
  if (tfidfIndex && tfidfIndexMtime === bridgeMtime) return;

  const docTokens = [];
  const df = new Map(); // document frequency
  const docPaths = [];

  for (const file of files) {
    const tokens = tokenize(file.content);
    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    // Normalize TF by doc length
    const normTF = new Map();
    for (const [t, count] of tf) {
      normTF.set(t, count / tokens.length);
    }
    docTokens.push(normTF);
    docPaths.push(file.path);

    // Update document frequency
    for (const t of new Set(tokens)) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const N = files.length;
  // Compute IDF
  const idf = new Map();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N + 1) / (freq + 1)) + 1); // smoothed IDF
  }

  // Build TF-IDF vectors
  const vectors = [];
  for (const tf of docTokens) {
    const vec = new Map();
    for (const [term, tfVal] of tf) {
      const idfVal = idf.get(term) || 0;
      vec.set(term, tfVal * idfVal);
    }
    vectors.push(vec);
  }

  tfidfIndex = { vectors, docPaths, idf, N };
  tfidfIndexMtime = bridgeMtime;
}

/**
 * Cosine similarity between two sparse vectors (Maps).
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, weightA] of vecA) {
    magA += weightA * weightA;
    const weightB = vecB.get(term) || 0;
    dot += weightA * weightB;
  }
  for (const [, weightB] of vecB) {
    magB += weightB * weightB;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * TF-IDF semantic search.
 */
function tfidfSearch(query, topK = MAX_SEARCH_RESULTS) {
  buildTFIDFIndex();
  if (!tfidfIndex || tfidfIndex.N === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Build query vector
  const queryVec = new Map();
  for (const t of queryTokens) {
    queryVec.set(t, (queryVec.get(t) || 0) + 1);
  }
  // Normalize + apply IDF
  const normQueryVec = new Map();
  for (const [term, tf] of queryVec) {
    const idf = tfidfIndex.idf.get(term) || 0;
    normQueryVec.set(term, (tf / queryTokens.length) * idf);
  }

  // Score all docs
  const scores = [];
  for (let i = 0; i < tfidfIndex.vectors.length; i++) {
    const sim = cosineSimilarity(normQueryVec, tfidfIndex.vectors[i]);
    if (sim > 0) {
      scores.push({ idx: i, score: sim });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// ─── Wikilink Graph ──────────────────────────────────────────────────────────

/**
 * Get files that link TO this path (backlinks), from the memory set.
 */
function getBacklinks(targetPath) {
  const all = readAllMemoryFiles();
  const backlinks = [];
  for (const file of all) {
    if (file.path === targetPath) continue;
    // Check if any wikilink resolves to the target
    const targetName = path.basename(targetPath, ".md");
    if (file.wikilinks.some(l => l === targetName || l + ".md" === targetPath || l === targetPath)) {
      backlinks.push({ path: file.path, name: file.name });
    }
  }
  return backlinks;
}

// ─── MCP Protocol ────────────────────────────────────────────────────────────

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

// ─── Tool Implementations ────────────────────────────────────────────────────

function handleListMemories() {
  const index = readBridgeIndex();
  const memories = (index.memories || []).map((m) => {
    const file = readVaultFile(m.path);
    return {
      path: m.path,
      name: m.name,
      tags: m.tags || file?.frontmatter?.tags || [],
      priority: m.priority ?? 0,
      addedAt: m.addedAt || null,
      source: m.source || "manual",
      isFolder: m.isFolder || false,
      charCount: file?.content?.length || 0,
      wikilinkCount: file?.wikilinks?.length || 0,
    };
  });

  return {
    vaultName: index.vaultName || path.basename(vaultPath || ""),
    totalCount: memories.length,
    memories,
  };
}

function handleGetMemory(args) {
  const target = (args.path || args.name || "").trim();
  if (!target) return { error: "请提供 memory 的 path 或 name 参数" };
  if (!isPathSafe(target)) return { error: "路径包含不安全字符" };

  const index = readBridgeIndex();
  const memories = index.memories || [];

  // Exact match
  let match = memories.find(m => m.path === target || m.name === target);
  let matchType = "exact";

  // Partial match (case-insensitive)
  if (!match) {
    const lower = target.toLowerCase();
    const partial = memories.filter(
      m => m.path?.toLowerCase().includes(lower) || m.name?.toLowerCase().includes(lower)
    );
    if (partial.length === 0) {
      return {
        found: false,
        query: target,
        availableMemories: memories.map(m => ({ path: m.path, name: m.name })),
      };
    }
    if (partial.length === 1) {
      match = partial[0];
      matchType = "partial";
    } else {
      return {
        found: false, query: target, ambiguous: true,
        message: `找到 ${partial.length} 个匹配项，请使用更精确的路径或名称`,
        candidates: partial.map(m => ({ path: m.path, name: m.name })),
      };
    }
  }

  // Read live content
  const file = readVaultFile(match.path);
  return {
    found: true, matchType,
    path: match.path, name: match.name,
    content: file?.content || match.content || "",
    frontmatter: file?.frontmatter || {},
    tags: match.tags || file?.frontmatter?.tags || [],
    priority: match.priority ?? 0,
    source: match.source || "manual",
    wikilinks: file?.wikilinks || [],
    backlinks: getBacklinks(match.path),
    charCount: file?.content?.length || 0,
  };
}

function handleSearchMemories(args) {
  const query = args.query || args.q;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return { error: "请提供 query 或 q 搜索参数" };
  }

  const searchMode = args.mode || "semantic"; // "semantic" | "keyword" | "both"

  const index = readBridgeIndex();
  const memories = index.memories || [];
  const results = [];
  const seen = new Set();

  if (searchMode === "keyword" || searchMode === "both") {
    // Keyword fallback: direct string matching
    const lowerQuery = query.toLowerCase();
    for (const mem of memories) {
      if (seen.has(mem.path)) continue;
      const file = readVaultFile(mem.path);
      if (!file) continue;
      const content = file.content.toLowerCase();
      const idx = content.indexOf(lowerQuery);
      if (idx !== -1) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(file.content.length, idx + lowerQuery.length + 60);
        results.push({
          path: mem.path, name: mem.name,
          matchType: "keyword", score: null,
          snippet: (start > 0 ? "..." : "") + file.content.slice(start, end).replace(/\n/g, " ") + (end < file.content.length ? "..." : ""),
        });
        seen.add(mem.path);
      }
    }
  }

  if (searchMode === "semantic" || searchMode === "both") {
    // TF-IDF semantic search
    const ranked = tfidfSearch(query);
    for (const { idx, score } of ranked) {
      if (seen.has(tfidfIndex.docPaths[idx])) continue;
      const filePath = tfidfIndex.docPaths[idx];
      const file = readVaultFile(filePath);
      if (!file) continue;
      // Generate snippet around highest TF-IDF term
      const queryTokens = tokenize(query);
      let snippet = file.content.slice(0, MAX_SNIPPET_LEN).replace(/\n/g, " ");
      if (file.content.length > MAX_SNIPPET_LEN) snippet += "...";

      results.push({
        path: filePath,
        name: path.basename(filePath, ".md"),
        matchType: "semantic",
        score: Math.round(score * 100) / 100,
        snippet,
      });
      seen.add(filePath);
    }
  }

  // Limit results
  const limited = results.slice(0, MAX_SEARCH_RESULTS);

  return {
    query, searchMode, resultCount: limited.length, results: limited,
  };
}

function handleWriteMemory(args) {
  const name = args.name;
  const content = args.content;
  const mode = args.mode || "create";
  const folder = args.folder || "AI记忆";

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "请提供有效的 name 参数" };
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return { error: "请提供有效的 content 参数" };
  }
  if (!isPathSafe(name) || !isPathSafe(folder)) {
    return { error: "名称或文件夹路径包含不安全字符" };
  }
  if (content.length > MAX_FILE_SIZE) {
    return { error: `内容过大 (${(content.length / 1024).toFixed(0)}KB)，超过 ${MAX_FILE_SIZE / 1024}KB 限制` };
  }

  const data = readBridgeIndex();
  const pendingWrites = data.pendingWrites || [];
  const writeRequest = {
    id: `write_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    content: content,
    mode: mode === "append" ? "append" : "create",
    folder: folder || "AI记忆",
    timestamp: new Date().toISOString(),
    status: "pending",
  };

  pendingWrites.push(writeRequest);

  const bridgeFile = getBridgeFilePath();
  try {
    const updatedData = { ...data, pendingWrites };
    fs.writeFileSync(bridgeFile, JSON.stringify(updatedData, null, 2), "utf-8");
    invalidateBridgeCache();
    return {
      success: true,
      message: `记忆写入请求已排队: ${writeRequest.name}`,
      writeId: writeRequest.id,
      note: "写入请求已保存。在 Obsidian 中打开 AI Memory Bridge 面板时自动创建/更新对应的 .md 文件。",
      pendingWrite: writeRequest,
    };
  } catch (err) {
    return { error: `写入失败: ${err.message}` };
  }
}

function handleDeleteMemory(args) {
  const targetPath = args.path;
  const confirm = args.confirm;

  if (!targetPath || typeof targetPath !== "string" || targetPath.trim().length === 0) {
    return { error: "请提供有效的 path 参数" };
  }
  if (!isPathSafe(targetPath)) {
    return { error: "路径包含不安全字符" };
  }
  if (!confirm) {
    return {
      requiresConfirmation: true,
      message: `即将移除记忆: ${targetPath}。笔记原文件不会被删除。请设置 confirm: true 确认操作。`,
    };
  }

  const data = readBridgeIndex();
  const memories = data.memories || [];
  const idx = memories.findIndex(m => m.path === targetPath || m.path === targetPath.trim());

  if (idx === -1) {
    return {
      success: false,
      message: `未找到记忆: ${targetPath}`,
      availableMemories: memories.map(m => ({ path: m.path, name: m.name })),
    };
  }

  const removed = memories.splice(idx, 1)[0];
  data.memoryCount = memories.length;

  const bridgeFile = getBridgeFilePath();
  try {
    fs.writeFileSync(bridgeFile, JSON.stringify(data, null, 2), "utf-8");
    invalidateBridgeCache();
    return {
      success: true,
      message: `已移除记忆: ${removed.name}`,
      removed: { path: removed.path, name: removed.name },
      remainingCount: memories.length,
      note: "笔记文件未被删除，仅从 AI 记忆列表中移除。",
    };
  } catch (err) {
    return { error: `删除失败: ${err.message}` };
  }
}

// ─── Request Handler ─────────────────────────────────────────────────────────

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case "tools/list":
      return sendResponse(id, { tools: getToolDefinitions() });

    case "tools/call":
      return handleToolCall(id, params);

    case "notifications/initialized":
      break;

    default:
      return sendError(id, -32601, `Method not found: ${method}`);
  }
}

function getToolDefinitions() {
  return [
    {
      name: "list_memories",
      description: "列出所有 AI 记忆笔记，包含路径、名称、标签、字符数和 wikilink 数量。显示 vault 中已标记为记忆的笔记清单。",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_memory",
      description: "获取指定笔记的完整内容（实时读取 .md 文件），包含 frontmatter 元数据、wikilink 出链和反向链接。用作 AI 上下文记忆。",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "笔记的路径，如 folder/note.md" },
          name: { type: "string", description: "笔记名称（不含路径），如 note" },
        },
      },
    },
    {
      name: "search_memories",
      description: "在记忆笔记中搜索。默认使用 TF-IDF 语义搜索（理解同义词和相似概念），可切换为关键词搜索或两者结合。返回相关性排序的结果和内容片段。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词或自然语言查询" },
          q: { type: "string", description: "搜索关键词（query 的简写）" },
          mode: {
            type: "string",
            enum: ["semantic", "keyword", "both"],
            description: "搜索模式：semantic-TF-IDF语义（默认），keyword-关键词匹配，both-两者结合",
            default: "semantic",
          },
        },
        required: [],
      },
    },
    {
      name: "write_memory",
      description: "将 AI 生成的总结/决策/分析写入 Obsidian 笔记（通过 bridge 队列）。支持新建或追加。写入内容带 ai_generated: true frontmatter 标记。",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "笔记名称（不含路径和扩展名）" },
          content: { type: "string", description: "要写入的 Markdown 内容" },
          mode: { type: "string", enum: ["create", "append"], description: "create-新建（默认），append-追加", default: "create" },
          folder: { type: "string", description: "目标文件夹，默认 'AI记忆/'" },
        },
        required: ["name", "content"],
      },
    },
    {
      name: "delete_memory",
      description: "从 AI 记忆列表中移除笔记（不删除原文件）。需要 confirm: true 确认操作。",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "要移除的笔记路径" },
          confirm: { type: "boolean", description: "设置为 true 确认删除" },
        },
        required: ["path"],
      },
    },
  ];
}

function handleToolCall(id, params) {
  const { name, arguments: args } = params || {};
  const safeArgs = (args && typeof args === "object" && !Array.isArray(args)) ? args : {};
  let result;

  try {
    switch (name) {
      case "list_memories":   result = handleListMemories(); break;
      case "get_memory":      result = handleGetMemory(safeArgs); break;
      case "search_memories": result = handleSearchMemories(safeArgs); break;
      case "write_memory":    result = handleWriteMemory(safeArgs); break;
      case "delete_memory":   result = handleDeleteMemory(safeArgs); break;
      default: return sendError(id, -32601, `Tool not found: ${name}`);
    }

    return sendResponse(id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    });
  } catch (err) {
    return sendError(id, -32603, `Tool execution error: ${err.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, terminal: false,
  });

  let buffer = "";
  rl.on("line", (line) => {
    buffer += line;
    try {
      const request = JSON.parse(buffer);
      buffer = "";
      handleRequest(request);
    } catch (_) { /* incomplete JSON */ }
  });

  rl.on("close", () => gracefulShutdown());
  process.on("SIGINT", () => gracefulShutdown());
  process.on("SIGTERM", () => gracefulShutdown());

  process.stderr.write(`[AI Memory Bridge] MCP Server v${SERVER_VERSION} started\n`);
  if (vaultPath) process.stderr.write(`[AI Memory Bridge] Vault: ${vaultPath}\n`);
}

function gracefulShutdown() {
  process.stderr.write("[AI Memory Bridge] Shutting down...\n");
  process.exit(0);
}

main();

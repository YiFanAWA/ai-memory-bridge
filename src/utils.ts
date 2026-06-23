import { Vault, FileSystemAdapter } from "obsidian";

/**
 * Get the vault's filesystem base path in a type-safe way.
 * Single source of truth — used by both main.ts and BridgeSync.ts.
 */
export function getVaultBasePath(vault: Vault): string {
  const adapter = vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return "";
}

/**
 * Sensitive frontmatter keys that must be redacted before sending to AI models.
 * Keep in sync with SENSITIVE_FRONTMATTER_KEYS in mcp-bridge.js.
 */
const SENSITIVE_FRONTMATTER_KEYS = new Set([
  "api_key", "apikey", "api_secret", "apisecret",
  "token", "access_token", "secret", "password", "passwd",
  "private_key", "privatekey", "auth", "authorization",
  "credential", "credentials", "ssh_key", "pgp_key",
]);

/**
 * Parse YAML-like frontmatter from markdown content.
 * Returns key-value pairs. Handles simple lists [a, b, c].
 * Sensitive keys (API tokens, secrets, passwords) are redacted.
 *
 * NOTE: Keep in sync with parseMarkdown() in mcp-bridge.js.
 */
export function parseFrontmatter(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!content.startsWith("---")) return result;

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return result;

  const fm = content.slice(3, endIdx);
  for (const line of fm.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim();

    // Redact sensitive keys before they enter any AI context
    if (SENSITIVE_FRONTMATTER_KEYS.has(key.toLowerCase())) {
      result[key] = "[已隐藏]";
      continue;
    }

    let value: any = line.slice(colonIdx + 1).trim();

    // Parse list: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      // Unquote string values
      value = value.replace(/^["']|["']$/g, "");
    }
    result[key] = value;
  }
  return result;
}

/**
 * Extract [[wikilinks]] from markdown content.
 */
export function parseWikilinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

/**
 * MCP tool definitions — shared reference.
 * NOTE: The authoritative inputSchema definitions live in mcp-bridge.js getToolDefinitions().
 * When adding/renaming tools, update BOTH locations. Long-term: extract to shared .json file.
 */
export const MCP_TOOL_DEFINITIONS = [
  {
    name: "list_memories",
    description: "列出所有 AI 记忆笔记，包含路径、名称、标签、优先级和元数据。",
  },
  {
    name: "get_memory",
    description: "获取指定笔记的完整内容（实时读取 .md 文件），包含 frontmatter、wikilink 出链和反向链接。",
  },
  {
    name: "search_memories",
    description: "TF-IDF 语义搜索记忆笔记。支持 semantic/keyword/both 三种模式，返回相关性排序结果。",
  },
  {
    name: "write_memory",
    description: "将 AI 生成内容写入 Obsidian 笔记（桥接队列）。支持新建或追加，带 ai_generated frontmatter 标记。",
  },
  {
    name: "delete_memory",
    description: "从 AI 记忆列表移除笔记（不删除原文件）。需 confirm: true 确认。",
  },
];

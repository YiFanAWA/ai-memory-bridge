#!/bin/bash
# AI Memory Bridge — MCP Tool Regression Tests
# Usage: bash tests/run-tests.sh [--vault /path/to/vault]
# Default vault: D:/calude/liu2

VAULT="${1:-D:/calude/liu2}"
BRIDGE="node D:/calude/ai-memory-bridge/mcp-bridge.js --vault $VAULT"
PASS=0
FAIL=0

red()   { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }

# Helper: send a single MCP tool call and return the JSON-RPC response line
call_tool() {
  local id=$1 name=$2 args=$3
  (echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0.0\"}}}"
   echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}") \
  | $BRIDGE 2>/dev/null | tail -1
}

# Helper: extract a value from the JSON-RPC response text
get_field() {
  echo "$1" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(d.get('$2',''))" 2>/dev/null
}

check() {
  local label=$1 actual=$2 expected=$3
  if [ "$actual" = "$expected" ]; then
    green "  ✓ $label"
    PASS=$((PASS + 1))
  else
    red "  ✗ $label (got: '$actual', expected: '$expected')"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================="
echo " AI Memory Bridge — 回归测试"
echo " Vault: $VAULT"
echo "========================================="
echo ""

# ─── 1. list_memories ───────────────────────────────────────────────

echo "[1/5] list_memories"
RESULT=$(call_tool 101 "list_memories" "{}")
TOTAL=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(d['totalCount'])" 2>/dev/null)

if [ "$TOTAL" -ge 0 ] 2>/dev/null; then
  green "  ✓ totalCount=$TOTAL"
  PASS=$((PASS + 1))
else
  red "  ✗ list_memories failed"
  FAIL=$((FAIL + 1))
fi

# Check new fields exist (use python to parse)
HAS_TAGS=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); ms=d.get('memories',[]); print(1 if ms and 'tags' in ms[0] else 0)" 2>/dev/null)
HAS_PRIORITY=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); ms=d.get('memories',[]); print(1 if ms and 'priority' in ms[0] else 0)" 2>/dev/null)
check "has tags field" "$HAS_TAGS" "1"
check "has priority field" "$HAS_PRIORITY" "1"

# ─── 2. get_memory ──────────────────────────────────────────────────

echo "[2/5] get_memory"
# Check exact match — verify JSON-RPC is valid without parsing inner content
RESULT=$(call_tool 102 "get_memory" '{"path":"AI项目开发规范.md"}')
IS_VALID=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(1 if 'result' in r else 0)" 2>/dev/null)
check "exact match returns valid JSON-RPC" "$IS_VALID" "1"

# Test partial match
RESULT=$(call_tool 105 "get_memory" '{"name":"ClaudeCode"}')
HAS_CONTENT=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(1 if 'result' in r else 0)" 2>/dev/null)
check "partial match returns valid JSON-RPC" "$HAS_CONTENT" "1"

# Test not found
RESULT=$(call_tool 106 "get_memory" '{"name":"nonexistent_xyz"}')
NOT_FOUND=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(d.get('found',''))" 2>/dev/null)
check "not found" "$NOT_FOUND" "False"

# ─── 3. search_memories ─────────────────────────────────────────────

echo "[3/5] search_memories"
RESULT=$(call_tool 103 "search_memories" '{"query":"MCP 配置","mode":"semantic"}')
COUNT=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(d['resultCount'])" 2>/dev/null)
if [ "$COUNT" -ge 1 ] 2>/dev/null; then
  green "  ✓ semantic search found $COUNT results"
  PASS=$((PASS + 1))
else
  red "  ✗ semantic search returned 0 results"
  FAIL=$((FAIL + 1))
fi

# Test keyword mode
RESULT=$(call_tool 107 "search_memories" '{"query":"MCP","mode":"keyword"}')
K_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(d['resultCount'])" 2>/dev/null)
if [ "$K_COUNT" -ge 1 ] 2>/dev/null; then
  green "  ✓ keyword search found $K_COUNT results"
  PASS=$((PASS + 1))
else
  red "  ✗ keyword search returned 0 results"
  FAIL=$((FAIL + 1))
fi

# Test empty query validation — handler-level check (no required fields in schema for search)
RESULT=$(call_tool 108 "search_memories" '{}')
HAS_ERROR=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); d=json.loads(r['result']['content'][0]['text']); print(1 if 'error' in d else 0)" 2>/dev/null)
check "empty query validation" "$HAS_ERROR" "1"

# ─── 4. write_memory ────────────────────────────────────────────────

echo "[4/5] write_memory"
RESULT=$(call_tool 104 "write_memory" '{"name":"回归测试","content":"自动化测试写入","mode":"create","folder":"AI记忆"}')
WRITE_OK=$(echo "$RESULT" | grep -c '"jsonrpc":"2.0"' || echo 0)
check "write returns valid JSON-RPC" "$WRITE_OK" "1"

# Test empty name validation (now caught by schema validation with -32602 error code)
RESULT=$(call_tool 109 "write_memory" '{"name":"","content":"test"}')
HAS_ERR=$(echo "$RESULT" | grep -c '\-32602' || echo 0)
check "empty name validation" "$HAS_ERR" "1"

# ─── 5. Security ────────────────────────────────────────────────────

echo "[5/5] security"
# Path traversal
RESULT=$(call_tool 110 "get_memory" '{"path":"../../../etc/passwd"}')
BLOCKED=$(echo "$RESULT" | grep -c '不安全' || echo 0)
check "path traversal blocked" "$BLOCKED" "1"

# Delete confirm gate
RESULT=$(call_tool 111 "delete_memory" '{"path":"test.md"}')
NEEDS_CONFIRM=$(echo "$RESULT" | grep -c 'requiresConfirmation' || echo 0)
check "delete confirm gate" "$NEEDS_CONFIRM" "1"

# ─── Summary ────────────────────────────────────────────────────────

echo ""
echo "========================================="
echo " Results: $(green "$PASS passed") / $((PASS + FAIL)) total"
if [ $FAIL -eq 0 ]; then
  green " ALL TESTS PASSED"
else
  red " $FAIL TEST(S) FAILED"
fi
echo "========================================="

# Cleanup test pending writes
python3 -c "
import json
bridge_file = '$VAULT/.obsidian/ai-memory-bridge/memory-bridge.json'
with open(bridge_file) as f:
    data = json.load(f)
data['pendingWrites'] = []
with open(bridge_file, 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
" 2>/dev/null || true

exit $FAIL

#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

case "${1:-}" in
    '') live=false ;;
    --live) live=true ;;
    *) echo "Usage: bash backend/test.sh [--live]" >&2; exit 2 ;;
esac
if (( $# > 1 )); then
    echo "Usage: bash backend/test.sh [--live]" >&2
    exit 2
fi
command -v node >/dev/null
command -v curl >/dev/null
node --input-type=module -e '
    if (Number(process.versions.node.split(".")[0]) < 22) {
        throw new Error("Node.js 22 or newer is required.");
    }
'

# Offline provider stubs: no credentials or API credits needed.
node --test

export PORT="${TEST_PORT:-3101}"
export HOST=127.0.0.1
export FRONTEND_ORIGIN=http://localhost:8080
base="http://127.0.0.1:$PORT"
if curl --silent --output /dev/null --max-time 1 "$base/api/health"; then
    echo "Port $PORT is occupied. Set TEST_PORT to an unused port." >&2
    exit 1
fi
work=$(mktemp -d)
server_pid=''
cleanup() {
    if [[ -n "$server_pid" ]]; then
        kill "$server_pid" 2>/dev/null || true
        wait "$server_pid" 2>/dev/null || true
    fi
    rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ "$live" == true ]]; then
    echo 'Live mode: two Gemini and two ElevenLabs requests; uses API credits.'
    node main.js >"$work/server.log" 2>&1 &
else
    GEMINI_API_KEY=offline-test ELEVENLABS_API_KEY=offline-test \
        node main.js >"$work/server.log" 2>&1 &
fi
server_pid=$!
ready=false
for ((attempt = 0; attempt < 50; attempt++)); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
        echo 'Server exited. Check dependencies, port, and backend/.env (live mode).' >&2
        exit 1
    fi
    if curl --silent --fail --max-time 1 "$base/api/health" >"$work/health.json"; then
        ready=true
        break
    fi
    sleep 0.1
done
[[ "$ready" == true ]] || { echo 'Server did not become ready.' >&2; exit 1; }
node --input-type=module -e '
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";
    assert.equal(JSON.parse(readFileSync(process.argv[1])).status, "ok");
' "$work/health.json"

request() {
    local expected="$1"
    shift
    local actual
    actual=$(curl --silent --show-error --max-time 60 \
        --output "$work/response.json" --write-out '%{http_code}' "$@")
    if [[ "$actual" != "$expected" ]]; then
        echo "FAIL: expected HTTP $expected, received $actual" >&2
        cat "$work/response.json" >&2
        printf '\n' >&2
        # Print only the backend's redacted diagnostic, not arbitrary SDK logs.
        sed -n '/^Gemini request failed:/p' "$work/server.log" >&2
        exit 1
    fi
}
request 204 -X OPTIONS -H "Origin: $FRONTEND_ORIGIN" "$base/api/react"
request 403 -H 'Origin: https://not-allowed.example' "$base/api/health"
request 405 "$base/api/react"
request 404 "$base/missing"
request 415 -X POST --data '{}' "$base/api/react"
request 400 -H 'Content-Type: application/json' --data '{' "$base/api/react"
request 400 -H 'Content-Type: application/json' --data '{}' "$base/api/react"
request 400 -H 'Content-Type: application/json' \
    --data '{"target":"__proto__","offered_item":"apple"}' "$base/api/react"
node -e 'process.stdout.write(JSON.stringify({padding: "x".repeat(9000)}))' >"$work/large.json"
request 413 -H 'Content-Type: application/json' --data-binary "@$work/large.json" "$base/api/react"
echo 'PASS: offline reactions and HTTP validation'

if [[ "$live" == true ]]; then
    for offered in apple orange; do
        request 200 -H 'Content-Type: application/json' \
            --data "{\"target\":\"orange\",\"offered_item\":\"$offered\",\"history\":[]}" "$base/api/react"
        node --input-type=module - "$work/response.json" "$offered" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const result = JSON.parse(readFileSync(process.argv[2]));
const success = process.argv[3] === 'orange';
assert.equal(result.success, success);
assert.equal(typeof result.dialogue, 'string');
assert.ok(result.dialogue.trim());
assert.ok(result.dialogue.trim().split(/\s+/).length < 15);
assert.ok(['annoyed', 'hopeful', 'sad', 'excited'].includes(result.emotion));
assert.ok(result.clue === null || typeof result.clue === 'string');
if (success) {
    assert.equal(result.emotion, 'excited');
    assert.equal(result.clue, null);
} else {
    assert.doesNotMatch(result.dialogue, /\boranges?\b/i);
}
assert.equal(result.audio_error, null, 'ElevenLabs failed; check key, voice ID, and quota.');
assert.equal(result.audio?.mime_type, 'audio/mpeg');
assert.ok(Buffer.from(result.audio.base64, 'base64').length > 0);
console.log(`PASS: ${success ? 'correct' : 'wrong'} offer with audio: ${result.dialogue}`);
JS
    done
fi

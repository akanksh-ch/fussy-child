# Fussy Child API

Node.js 22 or newer. Uses the installed Google GenAI and ElevenLabs SDKs and Express 5.

## Run

From `backend/`, run `npm install`, configure `.env` using `.env.example`, then run `npm run dev` (watch mode) or `npm start`.
Existing environment variables take precedence over `.env`. Never put API keys in frontend environment variables.

The default address is `http://localhost:3001`. `GET /api/health` reports server health without calling either provider.
Set `FRONTEND_ORIGIN` to the exact browser origin if it differs from `http://localhost:8080`.
The default Timmy voice is `nNXPmxHfg9PtGzFxr9Zd` with `ELEVENLABS_MODEL_ID=eleven_v3`.
Set these values in Render too: existing environment variables override code defaults.
Eleven v3 uses stability `0` (Creative) for more emotional variation. Speech gets
`[whining]` plus an emotion tag for wrong choices, and `[excited] [laughs]` for wins.
The speech bubble stays free of tags. Other speech models receive plain dialogue.
Tag delivery depends on the selected voice; listen to judge the performance.
The default dialogue model is `gemma-4-26b-a4b-it`, accessed through the Gemini API.
Models are configurable through `GEMINI_MODEL` and `ELEVENLABS_MODEL_ID`.

## React to an offer

```sh
curl http://localhost:3001/api/react \
  -H 'Content-Type: application/json' \
  -d '{"target":"orange","offered_item":"apple","history":["banana"]}'
```

Valid IDs are defined in `../shared/items.json`: 12 foods across Fruit, Bakery, and Cake. `chocolate` remains chocolate cake; carrot is no longer playable.
`history` contains previous offers, excludes the current offer, and is limited to 50 IDs.
The browser owns the puzzle's target and history, as described in IDEA.md. New games need no backend reset.

The response contains:

```json
{
  "dialogue": "Not that one, Mum! My snack should taste sweet.",
  "emotion": "hopeful",
  "success": false,
  "clue": "My snack should taste sweet.",
  "clue_level": 1,
  "audio": { "mime_type": "audio/mpeg", "base64": "..." },
  "audio_error": null
}
```

Dialogue combines a generic model reaction with an authored clue. The model receives only success, never target details.
The backend restricts reactions to a small generic vocabulary and falls back to a fixed line for invalid output.
Clue levels are 1 for wrong guesses 1–2, 2 for 3–4, 3 for 5–6, and 4 thereafter.
Only distinct wrong item IDs count, including the current offer. Winning responses have `clue: null` and `clue_level: 0`.
Clues progress through broad trait, category, shared property, and distinguishing detail.
The backend computes success by comparing IDs. Emotion is `annoyed`, `hopeful`, `sad`, or `excited`.

To play the returned speech in a browser:

```js
if (response.audio) {
  const audio = new Audio(`data:${response.audio.mime_type};base64,${response.audio.base64}`);
  await audio.play(); // Handle rejection by offering a replay button.
}
```

Speech failure returns HTTP 200 with valid dialogue, `audio: null`, and `audio_error` so the game can continue.
Gemini failure returns HTTP 502; retry the same offer without advancing local game state.
Invalid requests return 400, oversized bodies 413, unsupported content types 415, and excess concurrent calls 429.
SDK requests have 20-second timeouts, including the speech stream. Requests are limited to 8 KB and four simultaneous generations.

This is a local demo API bound to loopback by default. CORS is not authentication; add authentication and per-user quotas before public deployment.
The frontend calls this API and displays the returned dialogue and clue history.

## Checks

From the repository root:

```sh
bash backend/test.sh
```

This runs the offline reaction check, starts a temporary local API with dummy keys,
and checks health, preflight, origin rejection, methods, paths, content types,
invalid input, malformed JSON, and body limits. No API credits are used.
Requires Node.js 22+, installed backend dependencies, Bash, and curl.
The script stops its server and removes temporary files on exit.
It uses port 3101; override it with `TEST_PORT=3102 bash backend/test.sh`.

To also check real Gemini dialogue and ElevenLabs audio, configure `backend/.env` first:

```sh
bash backend/test.sh --live
```

Live mode makes two requests to each provider (wrong offer and correct offer) and
uses API credits. Missing audio fails the live check, even though the API deliberately
returns dialogue when speech is unavailable. The check verifies nonempty audio;
listen in the browser to judge voice quality.

If a live request returns 502, the script also prints `Gemini request failed:` with
the provider status and a redacted message. Use this to distinguish rejected keys,
quota limits, unavailable models, invalid requests, and connection failures. The
browser still receives only the generic error. Existing shell environment variables
override `.env`, so also check for stale exported keys or model settings.

For only the offline reaction check, run `npm test` from `backend/`. It covers invalid
choices, generated hints, target-name filtering, authoritative success, speech payloads,
speech failure, and Gemini failure.

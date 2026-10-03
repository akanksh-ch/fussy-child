# Product Requirements Document — Timmy

Timmy is the original code name

## 1. Product

**Working title:** *Fussy child*

**Genre:** 2D conversational guessing game

**Platform:** Web browser

**Target session:** 1–3 minutes per puzzle

**Hackathon goal:** Demonstrate a compelling use of an LLM inside a game with a complete playable loop.

### Elevator pitch

> Timmy wants something from the shop, but refuses to tell Mum what it is. The player must figure it out by offering him different items. Timmy reacts naturally to each attempt, giving indirect clues without directly revealing his secret until the player gets it right.

---

# 2. Core Game Loop

```text
                    START
                      │
                      ▼
              Timmy has a
              secret item
                      │
                      ▼
             ┌────────────────┐
             │ Player chooses │
             │ an item        │
             └───────┬────────┘
                     │
                     ▼
               Gemini evaluates
               the interaction
                     │
             ┌───────┴────────┐
             │                │
             ▼                ▼
          Wrong             Correct
             │                │
             ▼                ▼
       Timmy reacts        Timmy celebrates
       + gives clue             │
             │                  ▼
             │                WIN
             │
             └───────► Try again
```

The critical mechanic is:

**The player learns through experimentation.**

The game shouldn't feel like:

> "Guess the correct item."

It should feel like:

> "Figure out what this weird little NPC is trying to communicate."

---

# 3. Example

Secret target:

**🍊 Orange**

Inventory:

```text
🍎 Apple
🍌 Banana
🍊 Orange
🍓 Strawberry
🥕 Carrot
🍫 Chocolate
```

Player clicks Apple.

Timmy:

> "Yeah! It's a fruit... but that's not what I want."

Player clicks Banana.

Timmy:

> "Nooo. I don't want something yellow."

Player clicks Strawberry.

Timmy:

> "That's yummy, but I want something round."

Player clicks Orange.

Timmy:

> "YES! THAT'S IT!"

This demonstrates the entire concept in ~30 seconds.

---

# 4. Product Requirements

## Must Have

### Game

* 2D browser game
* Pokémon-inspired dialogue layout
* Mum on left
* Timmy on right
* Timmy speech bubble
* Item inventory along bottom
* Clickable items
* Item selection animation
* Win condition
* Reset/new game

### AI

Gemini must:

* Know Timmy's hidden target
* Receive the player's selected item
* Compare target vs selected item
* Generate a natural reaction
* Provide an indirect clue
* Avoid directly revealing the target
* Determine whether the player succeeded
* Return structured JSON

### Voice

ElevenLabs:

* Convert Timmy's generated response to speech
* Play audio after the response
* Ideally use a child-like/cartoon voice if an appropriate licensed voice is available

### Presentation

* Timmy changes emotion
* Dialogue appears in speech bubble
* Inventory visually responds to clicks
* Correct answer produces a celebration
* Wrong answer produces a reaction

---

# 5. Nice to Have

Only do these if the core game is finished:

* New puzzle button
* Multiple scenarios
* Timmy animations
* Mum dialogue
* Sound effects
* Confetti
* Item hover animation
* Typing effect
* Generated puzzles
* Difficulty levels

---

# 6. Explicitly Out of Scope

For the 4-hour version:

* Multiplayer
* Voice input
* Speech recognition
* 3D
* Open world
* Player movement
* Inventory management
* Database
* Accounts
* Authentication
* Persistent player profiles
* NPC long-term memory
* RAG
* Vector database
* LangChain
* LangGraph
* MCP
* AI agents
* Complex physics
* Procedural environments
* Mobile app
* Native desktop app

The game should be **one screen**.

---

# 7. UI

I'd use this exact composition:

```text
┌────────────────────────────────────────────────────────┐
│                                                        │
│    MUM                              TIMMY              │
│                                                        │
│   ┌──────┐                         ┌───────────────┐   │
│   │      │                         │ I WANT       │   │
│   │ 👩   │                         │ SOMETHING!   │   │
│   │      │                         └───────────────┘   │
│   └──────┘                              👦             │
│                                                        │
│                                                        │
│                                                        │
│                                                        │
├────────────────────────────────────────────────────────┤
│                   SHOP INVENTORY                       │
│                                                        │
│   ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐     │
│   │ 🍎 │  │ 🍌 │  │ 🍊 │  │ 🍓 │  │ 🥕 │  │ 🍫 │     │
│   │    │  │    │  │    │  │    │  │    │  │    │     │
│   └────┘  └────┘  └────┘  └────┘  └────┘  └────┘     │
│                                                        │
│             "Give Timmy an item"                      │
└────────────────────────────────────────────────────────┘
```

The Pokémon influence should be in the **layout and interaction**, not necessarily copying Pokémon's art.

---

# 8. Technical Architecture

## High-level

```text
┌─────────────────────────────────────────────┐
│                 BROWSER                     │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │             PHASER GAME                 │ │
│ │                                         │ │
│ │  Scene                                   │ │
│ │   ├── Mum                              │ │
│ │   ├── Timmy                            │ │
│ │   ├── SpeechBubble                     │ │
│ │   ├── Inventory                        │ │
│ │   └── GameState                         │ │
│ │                                         │ │
│ └──────────────────┬──────────────────────┘ │
│                    │                        │
└────────────────────┼────────────────────────┘
                     │
              HTTPS POST /react
                     │
                     ▼
┌─────────────────────────────────────────────┐
│              NODE / EXPRESS                 │
│                                             │
│              Game API                      │
│                  │                          │
│          ┌───────┴────────┐                 │
│          ▼                ▼                 │
│       Gemini          ElevenLabs            │
│                                             │
└─────────────────────────────────────────────┘
```

---

# 9. Frontend Stack

## Phaser 4

[Phaser documentation](https://docs.phaser.io/?utm_source=chatgpt.com)

Responsible for:

* rendering
* sprites
* buttons
* inventory
* animations
* game state
* mouse interaction
* scene transitions

## TypeScript

Everything game-side should be TypeScript.

## Vite

Build/development server.

So:

```text
Phaser
+
TypeScript
+
Vite
```

That's your entire frontend.

---

# 10. Backend Stack

## Node.js

Runtime.

## Express

Tiny HTTP API.

```text
POST /api/react
```

That's basically the only important endpoint.

You don't need a sophisticated backend.

---

# 11. AI Stack

## Gemini

Gemini handles **Timmy's reasoning and dialogue**.

Don't ask Gemini to control your entire game.

Instead:

```text
GAME STATE
    │
    ├── Target = Orange
    ├── Offered = Apple
    └── History = [Banana]
              │
              ▼
            GEMINI
              │
              ▼
        STRUCTURED RESPONSE
```

---

# 12. Gemini Input

Something like:

```json
{
  "target": {
    "name": "orange",
    "category": "fruit",
    "colour": "orange",
    "shape": "round",
    "taste": "sweet and citrusy"
  },
  "offered_item": {
    "name": "apple",
    "category": "fruit",
    "colour": "red",
    "shape": "round",
    "taste": "sweet"
  },
  "history": [
    "banana"
  ]
}
```

---

# 13. Gemini Output

Force structured output:

```json
{
  "dialogue": "Yeah, it's a fruit! But that's not what I want.",
  "emotion": "annoyed",
  "success": false,
  "clue_type": "category"
}
```

Your Phaser code then does:

```text
dialogue → speech bubble
emotion → Timmy sprite
success → game state
clue_type → optional animation/UI
```

---

# 14. Important AI Constraint

The system prompt should establish:

> Timmy knows the target but must not directly reveal it.

Something along these lines:

```text
You are Timmy, a fussy child in a shop.

You secretly want one specific item.

The player is trying to discover the item by offering
you different things.

React naturally to each offered item.

If the item is wrong:
- explain why you don't want it
- optionally reveal an indirect property of your target
- never directly state the target's name

If the item is correct:
- celebrate
- set success=true

Never reveal the target before the player selects it.

Keep dialogue under 15 words.

Return JSON only.
```

---

# 15. ElevenLabs

ElevenLabs handles **voice**, not game logic.

```text
Gemini
   │
   │ "That's a fruit, but not that one!"
   ▼
ElevenLabs
   │
   ▼
audio
   │
   ▼
Browser
   │
   ▼
Timmy speaks
```

If latency becomes annoying, **pre-generate the audio for your main demo scenarios**.

That's an excellent hackathon safety net.

---

# 16. Game State

Keep this entirely in memory.

```typescript
interface GameState {
    target: Item;
    attempts: Item[];
    gameOver: boolean;
}
```

And:

```typescript
interface Item {
    id: string;
    name: string;
    category: string;
    colour?: string;
    shape?: string;
    taste?: string;
    sprite: string;
}
```

Example:

```typescript
const orange: Item = {
    id: "orange",
    name: "orange",
    category: "fruit",
    colour: "orange",
    shape: "round",
    taste: "sweet and citrusy",
    sprite: "orange"
};
```

No database.

---

# 17. Scenarios

I'd hardcode **4 scenarios**.

### Scenario 1 — Orange

```text
🍎 Apple
🍌 Banana
🍊 Orange
🍓 Strawberry
🥕 Carrot
🍫 Chocolate
```

### Scenario 2 — Chocolate

```text
🍎 Apple
🍪 Cookie
🍫 Chocolate
🍌 Banana
🍦 Ice Cream
🥕 Carrot
```

### Scenario 3 — Toy Car

```text
🔵 Ball
🚗 Red Car
🦖 Dinosaur
🧸 Teddy
✈️ Plane
🚚 Truck
```

### Scenario 4 — Ice Cream

```text
🍰 Cake
🥛 Milk
🍦 Ice Cream
🍫 Chocolate
🍎 Apple
🍪 Cookie
```

These cover different semantic relationships.

---

# 18. Assets

Using the free assets found in assets/

Kenny ui pack pixel adventure
and free pixel art for food

Use:

* food sprites
* character sprites
* UI panels
* buttons
* inventory frames

Don't spend time making assets yourself.


---

# 20. API Security

Never do this:

```text
Phaser → Gemini API directly
```

because your Gemini API key ends up in the browser.

Instead:

```text
Phaser
   ↓
your backend
   ↓
Gemini
```

`.env`:

```text
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
```

---

# 21. Hosting

### Frontend

**Vercel**

```text
GitHub
   ↓
Vercel
   ↓
timmy.vercel.app
```

### Backend

**Render**

```text
GitHub
   ↓
Render
   ↓
timmy-api.onrender.com
```

You can also run the backend locally during development and only deploy once everything works.

For a 4-hour event, **don't make deployment your first problem**.

---

# 22. Development Order

This matters more than the technology.

### Phase 1 — 30 minutes

Get this:

```text
Phaser
   ↓
screen
   ↓
Timmy + inventory
```

working.

No AI.

### Phase 2 — 30 minutes

Make clicking work:

```text
click 🍎
     ↓
"Apple selected"
```

### Phase 3 — 45 minutes

Connect Gemini:

```text
click 🍎
   ↓
backend
   ↓
Gemini
   ↓
Timmy dialogue
```

At this point you have the **actual game**.

### Phase 4 — 30 minutes

Add:

```text
dialogue → ElevenLabs → audio
```

### Phase 5 — 45 minutes

Polish:

* sprites
* inventory
* speech bubble
* animations
* emotions
* sound
* transitions

### Phase 6 — remaining time

Prepare the demo and fix things.

**Do not spend the final 15 minutes adding features.**

---

# 23. What Makes This an AI Hackathon Project?

This is important for your pitch.

The AI isn't just:

> "NPC says random funny things."

The game has a **hidden state**:

```text
           TARGET
             │
             ▼
        ┌───────────┐
        │   ORANGE  │
        └─────┬─────┘
              │
       ┌──────┴──────┐
       │             │
    PLAYER        HISTORY
    ATTEMPT          │
       │             │
       └──────┬──────┘
              ▼
           GEMINI
              │
       ┌──────┴──────┐
       │             │
   REACTION       INFORMATION
       │             │
       └──────┬──────┘
              ▼
           PLAYER
              │
              ▼
          NEXT GUESS
```

The LLM turns **natural-language interaction into the game's information-discovery mechanic**.

That's the core idea I'd build the entire presentation around.

---

# 24. Final Technology Choice

If you want the answer reduced to one line:

> **Phaser 4 + TypeScript + Vite → Node.js/Express → Gemini API + ElevenLabs → Vercel frontend + Render backend → Kenney CC0 assets.**

And importantly, **no React, no Unity, no database, no agent framework**.

For four hours, that's enough technology to build the whole thing and leave time for the part that actually matters: making Timmy funny and the interaction feel surprisingly intelligent.


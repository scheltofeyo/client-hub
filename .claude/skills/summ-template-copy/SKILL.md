---
name: summ-template-copy
description: Generate SUMM-toned copy for project-template seed entries. Takes a service name + size variant (and optional raw notes) and emits a paste-ready TypeScript SeedTemplate object for scripts/data/project-templates.ts. Use when the user says "/summ-template-copy", "schrijf SUMM copy voor X", "enrich the Y templates", "vul Cultureel DNA – M in", or any variant of authoring/refreshing project-template seed content. Body copy is always Dutch (SUMM ToV); code keys stay English.
---

# summ-template-copy

Author SUMM-toned project-template seed content. The output of this skill drops into the `SEED_PROJECT_TEMPLATES` array in [scripts/data/project-templates.ts](scripts/data/project-templates.ts) and gets persisted via `npm run seed:templates`.

The skill **emits text only** — it does NOT write into the seed file. The user pastes the output themselves so they can review and place it in the right ordered comment block.

---

## When to run

Trigger when the user:

- types `/summ-template-copy`, `/summ-template-copy <service> <size>`, or asks to "enrich", "vullen", "uitschrijven" templates in this repo.
- says things like "schrijf SUMM copy voor [service]", "vul [service] – [size] in", "maak een SUMM template voor [thema]".
- pastes raw notes / a CSV row / a draft and asks you to "SUMMificeer dit".

If invoked with no service name, ask which template(s) to write. Default is one size at a time — but if the user asks for "alle Cultureel DNA varianten", emit S, M and L sequentially.

---

## Input

The skill accepts:

1. **Service name + size variant** (required for sized services). Map informal names to the canonical Service in `references/services-map.md` if uncertain — e.g. "Culturele Diagnose" → `serviceName: "Surveys"` (not the obvious "Culturele Diagnose", that service doesn't exist in the DB).
2. **Optional raw notes**: bullet jot, CSV row paste, voice-memo transcript, draft text, screenshot description.
3. **Optional overrides**: e.g. "Skip Activities — we'll fill manually", "Why should be two paragraphs", "Include EVP in Deliverables".

If raw notes are missing, the skill works from the references alone (see "References" below).

---

## Output

A single paste-ready TypeScript object literal that drops into `SEED_PROJECT_TEMPLATES`. Format must match the file's existing entries exactly:

```ts
{
  name: "Service name – M",
  summary:
    "Consultant-facing pick-guidance.",
  serviceName: "Canonical Service Name",
  defaultDescription: p("…"),
  defaultWhy: p("…"),
  defaultWhat: p("…"),
  defaultHow: p("…"),
  defaultActivities: introList("Aanpak:", ulTitled([
    ["Title", "Purpose sentence."],
    // …
  ])),
  defaultDeliverables: introList("Branded presentatie met:", ul([
    "Noun phrase",
    // …
  ])),
  defaultDeliveryDays: 28,
  sessions: [
    { title: "Klant-sessie naam", info: "Korte prep- of context-notitie." },
    // …
  ],
},
```

Above the object, include a short comment block summarising the calls made — e.g. "Why/What identical to other size; How is the L-variant (includes Cultural Archetypes); Activities = 5 bullets from full menu". This lets the human reviewer sanity-check without re-reading the whole block.

**Helpers available in scope** (already imported in the seed file): `p`, `b`, `ul`, `ulTitled`, `introList`. **Never inline raw HTML strings.** Going through the helpers is the only safe way to keep the format right.

---

## References

Read these before writing copy. They live next to this SKILL.md in `references/`:

- **`references/tone-of-voice.md`** — SUMM's house style. Authoritative for voice, woordkeuze, don'ts. Read in full at least once per session.
- **`references/deep-dives.md`** — 12 themes + 9 services. Each has *Inzichten / Pijnpunten / Wat SUMM doet / Sales-haakjes*. This is the **inhoudelijke bron** for Why / What / How copy.
- **`references/mission-statement-reference.md`** — gold-standard worked example. Read it. The cadence, length and structure here are the bar.

Also consult — outside the skill folder:

- **`scripts/data/services-database.reference.csv`** (repo root) — operational source: who's the klant, how many sessions, what's the doorloop, what's in Activiteiten/Deliverable per size. **CSV wins on operational facts.**
- **`scripts/data/project-templates.ts`** — current seed. Read the Mission Statement M and L entries to see the gold-standard rendered as TypeScript. Match that shape.

---

## Source-of-truth precedence

When references disagree:

1. **`mission-statement-reference.md` wins on form** — cadence, length, intro lines, bullet structure.
2. **CSV wins on operational facts** — activity counts, sporen, doorloop, deliverable artefacts.
3. **Deep-dives win on inhoudelijke framing** — SUMM-thesis vocabulary, the *waarom* behind each activity.

When inventing entirely new content (no CSV row, no deep-dives section), borrow vocabulary from the closest matching theme in `deep-dives.md`.

---

## Field-by-field rules

### `summary` — consultant-facing pick-guidance

- 1–2 sentences. Max ~25 words.
- Answers: **"Wanneer kies ik deze size-variant?"**
- Sourced from CSV column "Omvang bepalende factoren".
- **Never** shown to clients. Don't write sales copy here.
- Examples:
  - ✅ "Kies bij 1–2 duidelijke leiders (founder/CEO) of een klein, besluitvaardig leiderschapsteam."
  - ✅ "Standaard team waar je bestaande HR-processen wilt aanscherpen op cultuurgedreven werken."
  - ❌ "De ideale Mission Statement voor groeibedrijven die hun cultuur willen versterken." *(sales copy, niet consultant-helpend)*

### `defaultDescription` — short marketing pitch

- 1 `<p>` paragraph. ~50–80 words.
- Existing entries already have this. Don't rewrite unless explicitly asked.

### `defaultWhy` — client pain

- 1 `<p>`. 40–60 words. Two beats (what gaat mis → hoe zie je dat dagelijks terug).
- Opens at the symptom — never "SUMM helpt…" / "Een sterke cultuur is…".
- Uses *je* / *jullie*. Never *de klant* / *de organisatie*.
- Names *gedrag, keuzes, leiderschap, ritme* — things the client experiences breaking.
- **Stays identical across S/M/L of the same service** (the pain doesn't change with scope).

### `defaultWhat` — deliverable + thesis

- 1 `<p>`. 30–50 words. Two sentences.
- Sentence 1 names the deliverable explicitly: "Een scherpe [X]…", "Een cultuurgedreven [Y]…".
- Sentence 2 bridges to gedrag / leiderschap / beslissingen — the SUMM thesis.
- **Stays identical across S/M/L** (artefact qualitatively the same).

### `defaultHow` — method, single variant

- 1 `<p>`. 25–45 words.
- Verbs do the work: *brengen in beeld, vertalen, scherpstellen, verankeren, faciliteren, ontwerpen*.
- Names the *modaliteit* (sessies, interviews, scan, co-writing, training) and *werktuig* (Cultural Archetypes, Mission Statement framework, expert scan).
- Mentions the counterpart on the client side when relevant ("met het leiderschapsteam", "met expert leads", "met het co-writing team").
- **No `of:` alternatives.** Each template carries one clean How. If M and L differ methodologically, write two different Hows.

### `defaultActivities` — title + purpose bullets

- `introList("Aanpak:", ulTitled([…]))`.
- Intro is **always** "Aanpak:" — not "Optionele activities:", not anything else. Each size variant has its own fixed sequence.
- 3–7 bullets. S = 3–4, M = 4–5, L = 5–7.
- Each bullet = `["Title", "Purpose sentence."]`.
  - Title: sessie-naam, role-naam, or work-package name (e.g. "Founder interview", "Strategische sessie #1 met leiderschap", "Uitwerking door SUMM").
  - Purpose sentence: starts with the *doel*, ≤14 words, ends with a period (e.g. "Doel en strategische context scherpstellen.").
- `#1 / #2` numbering only when items are sequential AND of the same kind. Never on a unique "Intake".
- Activities scaling is **subset**, not rephrase: L is the full menu, M and S pick from it.

### `defaultDeliverables` — noun-phrase bullets

- `introList("…:", ul([…]))`.
- Intro names the **container**: "Branded presentatie met:", "Rapport met:", "Branded SUMM omgeving met:", "Trainingspakket met:".
- 3–6 bullets. Each ≤10 words.
- **Noun phrases**, not actions: "Geformuleerde Mission Statement", not "Formuleren van de Mission Statement".
- Colon-clarifications inline are fine: "Analyse van marktdynamieken: uitdagingen, kansen en onderscheidende troeven".
- Use *jullie* in possessive position: "wie jullie als organisatie zijn".

### `defaultDeliveryDays`

- Stays as-is from existing seed entries. Don't change unless explicitly asked.

### `sessions` — client-facing momenten only

- Array of `{ title: string; info?: string }`. Becomes a draft Session + "Plan {title}" task when a project is created from the template.
- **Only include sessions that involve the client.** Internal SUMM work (expert scan, uitwerking, concept design, copy writing, recap-writing) is silent — it does NOT get a session.
- `title` matches the corresponding Activities bullet title where possible (consistency between Activities and Sessions makes the project plan readable end-to-end).
- `info` is a short prep/context note: duur, # deelnemers, doel, format. Optional but encouraged — it's the one place the consultant sees per-session detail when scheduling.
- For activities that bundle multiple instances ("Interviews met sleutelspelers (6–8)", "Trainingssessies (~5 groepen)"): seed **one** session entry (e.g. `"Trainingssessie met deelnemers"`) — the consultant duplicates it at project-execution time. The `info` field flags the count.
- Order in the array = display order.
- Subscription-style templates (Platform licentie tiers) get **no sessions**.
- Activities scaling and session scaling track each other: L typically has more sessions than M, M more than S — same subset-logic as Activities.

---

## Sizing logic (S vs M vs L)

| Field | Scales? | How |
|---|---|---|
| `summary` | **Yes** | Different per size — that's the whole point of this field. |
| `defaultDescription` | Sometimes | Identical across sizes when the artefact is identical. Slight shift when L adds a qualitative layer (e.g. survey-based diagnose). |
| `defaultWhy` | **No** | Pain stays the same. |
| `defaultWhat` | **No** | Deliverable + thesis stay the same. |
| `defaultHow` | **Yes** | Write a different How per size when the *methodological tool* differs. If only the *count* of one activity changes, keep one How and let Activities/Deliverables scale. |
| `defaultActivities` | **Yes — by subset** | L is the full menu. M and S pick a subset; bullets themselves don't rephrase. |
| `defaultDeliverables` | Sometimes | Identical when the package is the same artefact at every size. Add/remove bullets only when the package qualitatively grows (e.g. L includes survey rapport). |
| `sessions` | **Yes — by subset** | Mirrors Activities scaling. L has the full client-facing session list; M and S drop sessions that aren't part of the size. Internal-only Activities (e.g. "Uitwerking door SUMM") never appear in sessions. |

---

## Voice rules (compressed from `tone-of-voice.md`)

**Do**
- Open Why with the pijn, never with SUMM or "wij".
- Use *jullie / je* consistently (second person).
- Use SUMM-kernwoorden: *gedrag, ritme, eigenaarschap, consistentie, leiderschap, systeem, groei, richting*.
- Capitalise "Mission Statement", "Cultureel DNA", "Cultural Archetypes", "Carrière Framework".

**Don't**
- No "wij van SUMM", "onze dienst is" — that's sales taal.
- No Engelse marketingtaal: *empower, unlock, leverage, impactful, holistic, mindset, transformatie, paradigma, purpose-driven*.
- No superlatieven (*uniek, dé oplossing, game changer*) or slogans.
- No theoretische beschouwingen — every sentence ties to action, decision or applied behaviour.

---

## Worked example

Trigger: `/summ-template-copy mission-statement l`

Output:

````
Mission Statement – L. Why/What identical to M (pain en deliverable scale niet
met size). How is the L-variant (includes Cultural Archetypes als analytisch
werktuig). Activities = 5 bullets (intake + interviews + 2 sessies + uitwerking).
Deliverables = 4 noun phrases including EVP.

```ts
{
  name: "Mission statement – L",
  summary:
    "Kies bij groter leiderschaps- of ownership-team (partner-groep, meebeslissende MT) waar meer afstemming en iteratie nodig zijn.",
  serviceName: "Mission Statement",
  defaultDescription: p(
    "We helpen je leiderschapsteam om de drijfveren, ambitie en het beoogd onderscheidend vermogen van je bedrijf helder en precies te formuleren, zodat dit kunnen dienen als een richtinggevende doelstelling bij het formuleren van je winnende culturele DNA."
  ),
  defaultWhy: p(
    "Zonder een expliciet en gedeeld doel ontstaan binnen je organisatie versnipperde keuzes, interne ruis en cultuurverschillen tussen teams. Zo wordt strategie iets wat alleen op papier staat, terwijl gedrag alle kanten op beweegt."
  ),
  defaultWhat: p(
    "Een scherpe Mission Statement maakt expliciet waar jullie voor bestaan en waarin jullie fundamenteel onderscheidend willen zijn. Daarmee wordt helder welk gedrag, welk leiderschap en welke beslissingen nodig zijn om die ambitie waar te maken."
  ),
  defaultHow: p(
    "In strategische sessies met het leiderschapsteam vertalen we drijfveren en ambitie naar een scherpe Mission Statement en gebruiken we Cultural Archetypes om jullie onderscheidend vermogen en positionering te versterken."
  ),
  defaultActivities: introList("Aanpak:", ulTitled([
    ["Intake met opdrachtgever / founder / CEO", "Doel en strategische context scherpstellen."],
    ["Interviews met sleutelpersonen (founders / leiderschap)", "Drijfveren, ambitie, strategische uitdagingen en kansen expliciteren."],
    ["Strategische sessie #1 met leiderschap", "Richting bepalen op ambitie, onderscheidend vermogen en archetypische positionering."],
    ["Strategische sessie #2 met leiderschap", "Presentatie en aanscherping van de uitgewerkte Mission Statement (why/how/what) en strategische implicaties."],
    ["Uitwerking door SUMM", "Analyse, formulering en scherpstelling van de definitieve Mission Statement."],
  ])),
  defaultDeliverables: introList("Branded presentatie met:", ul([
    "Geformuleerde Mission Statement (why/how/what)",
    "Analyse van marktdynamieken: uitdagingen, kansen en onderscheidende troeven",
    "Strategische positionering: wie jullie als organisatie zijn",
    "Geformuleerde Employer Value Proposition (EVP)",
  ])),
  defaultDeliveryDays: 28,
  sessions: [
    { title: "Intake met opdrachtgever / founder / CEO", info: "Doel en strategische context scherpstellen — startpunt van het traject." },
    { title: "Interviews met sleutelpersonen", info: "Meerdere individuele interviews (founders / leiderschap) — drijfveren, ambitie, uitdagingen en kansen expliciteren." },
    { title: "Strategische sessie #1 met leiderschap", info: "Richting bepalen op ambitie, onderscheidend vermogen en archetypische positionering." },
    { title: "Strategische sessie #2 met leiderschap", info: "Presentatie en aanscherping van de uitgewerkte Mission Statement (why/how/what) en strategische implicaties." },
  ],
},
```
````

---

## Workflow

1. Read the references (`tone-of-voice.md`, `mission-statement-reference.md`, the relevant section of `deep-dives.md`, the relevant row(s) of `services-database.reference.csv`).
2. Cross-check the user's input against the existing entry in `scripts/data/project-templates.ts` if one exists.
3. Draft each field following the per-field rules and sizing logic above.
4. **Show the draft to the user for review before emitting the final TypeScript object.** The user may want to tweak a sentence or swap a deliverable.
5. On approval, emit the final TS object with the summary comment header.
6. Remind the user to paste it into the correct comment block in `scripts/data/project-templates.ts` and to run `npm run seed:templates -- --force` to update the DB.

---

## What this skill does NOT do

- Does not write to `scripts/data/project-templates.ts` directly — user pastes.
- Does not run the seed script — user runs.
- Does not fill `defaultSoldPrice` or `defaultRoleAllocation` — those are added via the admin UI's Budget tab with role-based pricing.
- Does not invent new services or sizes that aren't in the existing seed list. If the user asks for a template variant that doesn't exist yet, raise it first.

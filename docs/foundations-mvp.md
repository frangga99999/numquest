# Fondasi Numerasi — MVP implementation

Date: 2026-09-12. Scope: the adult numeracy pathway requested after the enhancement PRD. The new UI is approved by the user's latest instruction; this supersedes the earlier visual-design hold for these screens.

## Product boundary

The persona is an adult with uneven basic numeracy, low confidence around arithmetic, and a preference for concrete visual explanations and smaller steps. No name, age, occupation, disability label, diagnosis, or fixed "learning type" is stored. Visuals are an available way to reason, not evidence of a cognitive limitation. The interface does not promise mastery within a fixed number of weeks. Session durations are suggestions.

This delivery is the first end-to-end slice of the proposed pathway, not the entire 103-section adaptive analytics PRD. It covers seven micro-lessons and 42 parameter sets, with three exercises per session. Fluency is represented by observed median correct-response time, not an invented normalized fluency score. Retention scores and a validated multidimensional assessment model are deferred.

## Capability audit and decisions

| Capability | Observed implementation | MVP decision |
| --- | --- | --- |
| Existing app shell/navigation | `src/App.jsx`, six game/learning destinations | Add the Fondasi entry, leave existing destinations accessible under Lainnya |
| State/account | `useGame` + `numquest.v1` in `src/store.js`, optional `/state` API | Extend the existing state under `foundation`; preserve existing identity and progress |
| Arithmetic exercise generators | `src/engine.js`: add/sub/mul/div concepts and difficulty tiers | Map new micro-concepts to existing skill IDs; use bounded parameters for beginner content |
| Lesson visuals | `LessonVisual.jsx`, `Session.jsx`: count, groups, numberline, etc. | Existing renderers reveal results and have game styling; add touchable scaffold renderer for guided lessons and hidden-answer practice |
| Existing session | `Session.jsx`: hearts, energy, speed, rewards | Separate calm session component inside the same application |
| Telemetry | `store.js`: rolling 500 legacy events; `days` aggregates | Keep canonical Fondasi history without truncation; adapter adds first-answer count/correct and active seconds to existing daily stats |
| SRS | `engine.js`: per-problem scheduling | Keep the existing SRS; add concept-level review for the new scaffolded pathway |
| Mastery | `engine.js`: accuracy/tier thresholds and day requirements | Separate supported learning evidence from legacy scoring; introduce an explicitly provisional independent-answer estimate |
| Progress | `Progress.jsx`: all-app progress | Add pathway view in the new shell; all-app progress remains accessible |
| Mentor | Existing AI/local coach for game sessions | Deterministic, reviewed Indonesian copy, one instruction per step; no LLM needed |

## MVP behaviors implemented

1. A mobile bottom navigation switches to a tablet side rail and desktop sidebar. Warm paper, forest green, restrained orange, local font fallbacks, no remote assets required on the Fondasi surface.
2. Home includes the next action, resumable session, a daily active-practice target, pathway preview, completed lesson count, and due review count.
3. Five untimed placement prompts accept numeric answers or explicit skip. Partial placement is resumable. Results describe observed responses, not a diagnosis or numeric ability score.
4. Seven lessons: quantity, addition, subtraction, multiplication, division, inverse relationships, everyday grouping. Each has a goal, three short explanations, interactive visual, and three practice questions.
5. Touch/keyboard interactions include count markers, subtractive crossed-out objects, group selection, and one-round-at-a-time equal distribution. Calculation questions can hide the scaffold until help is requested. Counting questions always show the objects being counted.
6. Wrong answers show a worked explanation, allow retry, and allow moving on. Retry after seeing the explanation is always marked assisted. Help is free. The pathway never spends hearts/energy, awards speed XP, or alters existing SRS/mastery.
7. Raw answer evidence, lesson start/completion, help, and review events retain event IDs, timestamps, local date, timezone, concept, exercise identity, attempts and assistance. Incorrect-answer heuristics are tentative signals; `error_type` remains `UNKNOWN` without sufficient evidence.
8. Mastery stays null until at least six first-attempt, unassisted responses across two sessions. The displayed estimate is the proportion correct among the last twelve independent responses. This is an MVP proxy, not the final 40/20/25/15 dimensional mastery model. Time does not affect this estimate.
9. Review is scheduled for 1, 3, or 7 elapsed days based on observed evidence. A difficult most-recent session recommends the same concept. A prerequisite estimate below 45 redirects the recommendation to that prerequisite. Manual topic selection remains available.
10. Progress supports today, 7 days, 30 days, and a validated custom date range. Accuracy uses first submissions, not retries. Active time excludes hidden tabs and idle periods over 60 seconds and is capped per answer. Lesson-reading time is not claimed as recorded study time.
11. Current mastery is clearly labeled as current across all time. Period cards and session history follow the date filter. Session history retains the mastery estimate at completion. Review dates include future dates.
12. Target minutes, reduced motion, default date period, and custom dates persist in the existing state. Session phase, problem index, attempt, assistance and feedback survive reload. Starting a different session asks explicitly what to do with the unfinished session.

## Data and integration contract

`g.foundation`: version, diagnostic/draft, preferences, concept completion + next review timestamps, canonical history, completed sessions, active session checkpoint.

`g.days[localDate]`: shared legacy daily aggregation receives first-submission attempts/correct and observed active answer seconds. Existing fields including XP, inventory, accounts, SRS and AI-path progress are preserved. Diagnostic prompts do not change legacy progress. Old scores are never backfilled as mastery or retention.

Current local dates use the browser's IANA timezone; a server-owned user timezone and timezone-change recomputation belong to the analytics phase. Raw history is retained in localStorage as part of the current state. It is not a durable production event backend, and aggregate reads for this MVP are local history reductions. Before scaling: append-only event endpoint, durable database, event idempotency, daily pre-aggregation, quota/retry handling, and a proper multi-device conflict model are required. The legacy Node API accepts a state payload up to 512 KB; do not silently drop history to bypass that bound.

Optional account synchronization reuses the existing `push` helper. The UI accurately promises device persistence; it does not claim verified cloud delivery. The existing Netlify function exposes AI/content routes but not the Node account/state endpoints. No Netlify authentication/deployment changes are included here.

Rollout flag: `VITE_NUMERACY_FOUNDATIONS=false` selects the existing entry at build time. Default is enabled for this MVP preview.

## Verification

- `npm run build`: production bundle builds.
- `npm run test:foundations`: dedicated regressions cover arithmetic, supported vs independent evidence, slow answers, missing data, duplicates/retries, old-state preservation, review timing, prerequisite check, local midnight and range totals, resume and untruncated history.
- Browser verification uses a separate localhost origin with test-only activity. Check mobile (320, 390), tablet (768/820/1024), desktop, input/retry/help, lesson completion, resume after reload, placement, custom-range preferences, and return to existing app.
- Existing full test suite has a pre-existing failure in the advanced logic challenge: requested 12 distinct questions vs a finite 7-question pool. This failure existed before this slice; it is not masked by the new test command.

## Next increments

1. Extend foundation content: make-ten, zero, two-digit addition/subtraction, multiplication strategies (2/5/10 first), division remainders, mixed-context transfer. Review pedagogical correctness with an adult numeracy educator.
2. Calibrate assessment with multiple equivalent items and different representations, not repeated facts alone. Add separate conceptual/calculation/application dimensions, confidence, and observed delayed-review retention.
3. Consolidate the full adaptive dashboard: durable events, timezone preference, daily aggregates, explicit source metadata, editable goals, persistent widget preferences, cross-device sync conflict handling.
4. Carry the new visual system into the existing library, account and advanced-session screens after verifying their workflows. The present delivery changes the primary Fondasi experience; legacy game screens retain their prior styling and functions.
5. Add AI explanations only on validated structured data. Keep all grading, scheduling, and numeric analytics deterministic. No leaderboard or progression based on speed is added to Fondasi.

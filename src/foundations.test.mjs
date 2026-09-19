import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blank } from './store.js'
import { skillById, dayKey } from './engine.js'
import { FOUNDATION_CONCEPTS, makeExercise, foundationOf, startFoundation, recordFoundationAnswer, foundationHelp, completeFoundation, masteryFor, recommendation, reviewQueue, summarizeFoundation, rangeDates } from './foundations.js'

const now = new Date('2026-09-12T10:00:00+07:00').getTime()
const practice = (g, id, answers = [true, true, true], assisted = false, seconds = 20, time = now) => {
  let next = startFoundation(g, id, 'learn', time)
  next.foundation.active.phase = 'practice'
  for (let i = 0; i < 3; i++) {
    next.foundation.active = { ...next.foundation.active, index: i, attempt: 1, answered: false, assisted: false }
    if (assisted) next = foundationHelp(next, 'hint_requested', time)
    const a = next.foundation.active, e = makeExercise(id, i, a.seed)
    next = recordFoundationAnswer(next, answers[i] ? e.answer : e.answer + 1, seconds, time)
  }
  return completeFoundation(next, time)
}

test('curriculum mappings exist and all exercise variants have consistent arithmetic', () => {
  for (const c of FOUNDATION_CONCEPTS) {
    assert.ok(skillById[c.skillId])
    assert.equal(c.steps.length, 3)
    for (let seed = 0; seed < 6; seed++) for (let i = 0; i < 3; i++) {
      const e = makeExercise(c.id, i, seed)
      const answer = { count: e.a, add: e.a + e.b, sub: e.a - e.b, groups: e.a * e.b, divide: e.a / e.b }[e.visual]
      assert.equal(e.answer, answer)
      assert.ok(Number.isInteger(answer) && answer >= 0)
      if (c.id === 'quantity') assert.equal(e.dimension, 'conceptual', 'counting always needs its visible objects')
      assert.deepEqual(e, makeExercise(c.id, i, seed), 'resume must preserve exercise')
    }
  }
})

test('empty historical data remains unknown; completion never implies mastery', () => {
  const f = foundationOf(blank())
  assert.equal(masteryFor(f, 'addition').score, null)
  assert.equal(summarizeFoundation(f, '2026-01-01', '2026-12-31').accuracy, null)
  const done = practice(blank(), 'addition')
  assert.equal(done.foundation.concepts.addition.completed, true)
  assert.equal(masteryFor(done.foundation, 'addition').score, null)
})

test('slow correct answers retain mastery; hints do not become independent evidence', () => {
  const slow = practice(practice(blank(), 'addition', undefined, false, 160), 'addition', undefined, false, 160)
  const fast = practice(practice(blank(), 'addition', undefined, false, 5), 'addition', undefined, false, 5)
  assert.equal(masteryFor(slow.foundation, 'addition').score, 100)
  assert.equal(masteryFor(fast.foundation, 'addition').score, 100)
  assert.equal(masteryFor(slow.foundation, 'addition').medianSeconds, 160)
  const supported = practice(practice(blank(), 'addition', undefined, true), 'addition', undefined, true)
  assert.equal(masteryFor(supported.foundation, 'addition').score, null)
  assert.equal(supported.foundation.sessions[0].independent, 0)
})

test('retries do not inflate accuracy; duplicate submissions and completions are ignored', () => {
  let g = startFoundation(blank(), 'multiplication', 'review', now)
  const e = makeExercise('multiplication')
  assert.equal(completeFoundation(g), g, 'cannot complete an unfinished session')
  g = recordFoundationAnswer(g, e.a + e.b, 10, now)
  const once = g
  assert.equal(recordFoundationAnswer(g, e.answer, 10, now), once)
  assert.equal(g.foundation.history.at(-1).metadata.error_signal.error_type, 'UNKNOWN')
  g.foundation.active = { ...g.foundation.active, attempt: 2, answered: false, assisted: true }
  g = recordFoundationAnswer(g, e.answer, 5, now)
  const stat = summarizeFoundation(g.foundation, dayKey(new Date(now)), dayKey(new Date(now)))
  assert.equal(stat.attempts, 1)
  assert.equal(stat.accuracy, 0)
  assert.equal(stat.seconds, 15)
  assert.equal(g.days[dayKey(new Date(now))].problems, 1)
  assert.equal(g.days[dayKey(new Date(now))].correct, 0)
  const done = practice(g, 'addition')
  assert.equal(completeFoundation(done), done)
})

test('existing saved progress, inventory, SRS and accounts survive foundation sessions', () => {
  const original = { ...blank(), handle: 'existing-user', xp: 430, hearts: 2, coins: 70, energy: 3, skills: { 'add-1d': { hist: [1, 0], days: [4] } }, srs: { 'add-1d:3,2:plain': { due: 99 } }, aiPath: { cleared: { a: 2 } } }
  const g = practice(original, 'addition', [false, false, true])
  for (const key of ['handle', 'xp', 'hearts', 'coins', 'energy', 'skills', 'srs', 'aiPath']) assert.deepEqual(g[key], original[key], key)
  assert.equal(recommendation(g.foundation, now).type, 'REMEDIAL')
  assert.equal(reviewQueue(g.foundation, now).length, 0)
  assert.equal(reviewQueue(g.foundation, now + 86400001)[0].id, 'addition')
})

test('mastery cannot be inferred from diagnostic and critical prerequisites are checked', () => {
  let g = practice(practice(blank(), 'addition', [false, false, false]), 'addition', [false, false, false])
  g = practice(g, 'quantity') // Recent success must not obscure the prerequisite gap.
  g.foundation.diagnostic = { answers: [{ conceptId: 'multiplication', correct: false }] }
  assert.equal(masteryFor(g.foundation, 'addition').score, 0)
  assert.equal(recommendation(g.foundation, now).concept.id, 'addition')
  assert.equal(recommendation(g.foundation, now).type, 'REMEDIAL')
})

test('period totals are additive and local midnight follows the browser timezone', () => {
  const first = new Date(2026, 8, 12, 23, 58).getTime(), second = new Date(2026, 8, 13, 0, 2).getTime()
  const g = practice(practice(blank(), 'addition', undefined, false, 30, first), 'subtraction', undefined, false, 20, second)
  const d1 = summarizeFoundation(g.foundation, '2026-09-12', '2026-09-12'), d2 = summarizeFoundation(g.foundation, '2026-09-13', '2026-09-13')
  const both = summarizeFoundation(g.foundation, '2026-09-12', '2026-09-13')
  assert.equal(both.seconds, d1.seconds + d2.seconds)
  assert.equal(both.attempts, 6)
  assert.equal(both.activeDays, 2)
  assert.deepEqual(rangeDates('7', new Date(2026, 8, 12)), { start: '2026-09-06', end: '2026-09-12' })
})

test('session resumes through JSON round-trip and raw history is not truncated', () => {
  let g = startFoundation(blank(), 'division', 'review', now)
  g = foundationHelp(g)
  const restored = JSON.parse(JSON.stringify(g))
  assert.equal(restored.foundation.active.assisted, true)
  assert.equal(restored.foundation.active.sessionId, g.foundation.active.sessionId)
  g.foundation.history = Array.from({ length: 510 }, (_, i) => ({ event_id: String(i), event_type: 'fixture' }))
  g = recordFoundationAnswer(g, 3, 10)
  assert.equal(g.foundation.history.length, 511)
})

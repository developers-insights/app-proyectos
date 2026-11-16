import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectProgress, progressBreakdown } from '../src/lib/progress.js'
import { taskPct, planProgress, weekProgress, currentWeekNumber, planBoardSummary } from '../src/plan/planModel.js'

const planCon = (done, total) => ({
  weeks: [{ n: 1, tasks: Array.from({ length: total }, (_, i) => ({ text: `t${i}`, done: i < done })) }],
})

test('etapa de desarrollo terminado no fuerza 100% si el plan tiene tareas abiertas', () => {
  const plan = planCon(143, 176)
  for (const stage of ['free', 'plan', 'finalizado', 'anual', 'partner']) {
    const p = { stage }
    assert.equal(projectProgress(p, plan), 81, stage)
    assert.equal(progressBreakdown(p, plan).pct, 81, stage)
  }
})

test('sin plan, la etapa terminada sigue mostrando 100%', () => {
  assert.equal(projectProgress({ stage: 'anual' }, null), 100)
  assert.equal(projectProgress({ stage: 'anual' }, { weeks: [] }), 100)
})

test('100% solo con todas las tareas hechas, 0% solo con ninguna', () => {
  assert.equal(taskPct(199, 200), 99)
  assert.equal(taskPct(200, 200), 100)
  assert.equal(taskPct(1, 300), 1)
  assert.equal(taskPct(0, 300), 0)
  assert.equal(taskPct(0, 0), 0)
  assert.equal(planProgress(planCon(199, 200)).pct, 99)
  assert.equal(weekProgress(planCon(199, 200).weeks[0]).pct, 99)
  assert.equal(planBoardSummary(planCon(199, 200)).pctInsights, 99)
  assert.equal(projectProgress({ stage: 'mvp' }, planCon(199, 200)), 99)
})

test('una semana con una tarea abierta sigue siendo la semana en curso', () => {
  assert.equal(currentWeekNumber(planCon(199, 200)), 1)
  assert.equal(currentWeekNumber(planCon(200, 200)), null)
})

import type { CaseDefinition, CaseFactDefinition } from './types'

export interface DynamicSemanticFactCandidate {
  id: string
  reason: string
}

const genericBigrams = new Set([
  '我是', '自己', '当时', '这个', '那份', '这份', '公司', '事情', '问题', '记录',
  '系统', '处理', '工作', '有关', '因为', '所以', '只是', '没有', '不是', '可以',
])

function compact(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}:]/gu, '')
}

function factSignals(value: string) {
  const normalized = compact(value)
  const signals = new Set<string>()
  for (const token of normalized.match(/[a-z0-9:_-]{2,}/g) ?? []) signals.add(token)
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const signal = normalized.slice(index, index + 2)
    if (/^[\p{Script=Han}]{2}$/u.test(signal) && !genericBigrams.has(signal)) signals.add(signal)
  }
  return signals
}

function hasExplicitTime(fact: CaseFactDefinition) {
  return [...`${fact.title} ${fact.description}`.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)].map((match) => match[0])
}

function includesExplicitDenial(reply: string, sharedSignals: string[]) {
  const normalized = compact(reply)
  return sharedSignals.some((signal) => new RegExp(`(?:没有|并未|从未|不曾|否认|不是).{0,10}${signal}`).test(normalized))
}

function matchFact(reply: string, fact: CaseFactDefinition) {
  const replySignals = factSignals(reply)
  const factText = `${fact.title} ${fact.description}`
  const titleSignals = factSignals(fact.title)
  const descriptionSignals = factSignals(factText)
  const shared = [...descriptionSignals].filter((signal) => replySignals.has(signal))
  const sharedTitleSignals = [...titleSignals].filter((signal) => replySignals.has(signal))
  const requiredTimes = hasExplicitTime(fact)

  if (requiredTimes.length > 0 && !requiredTimes.some((time) => compact(reply).includes(time))) return false
  if (shared.length < 3 || sharedTitleSignals.length < 1) return false
  if (includesExplicitDenial(reply, shared)) return false
  return true
}

/**
 * Conservative fallback for structured-output omissions. It searches only the
 * current dynamic case's facts owned by the current NPC; it never invents IDs.
 */
export function extractDynamicSemanticFactCandidates(input: {
  npcId: string
  reply: string
  caseDefinition: CaseDefinition
}): DynamicSemanticFactCandidate[] {
  return input.caseDefinition.facts
    .filter((fact) => fact.npcId === input.npcId)
    .filter((fact) => matchFact(input.reply, fact))
    .map((fact) => ({ id: fact.id, reason: 'reply 与当前动态案件中该 NPC 的事实标题及描述具有足够的明确语义重合' }))
}

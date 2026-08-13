import { behaviorRules } from '../prompts/behaviorRules'
import {
  goalSection, knowledgeBoundarySection, knownFactsSection, personalitySection,
  privateInformationSection, publicInformationSection, relationshipSection,
  speechSection, truthStrategySection,
} from '../prompts/sections'
import type { CaseDefinition } from './types'

export function buildDynamicNpcPrompt(caseDefinition: CaseDefinition, npcId: string, discoveredEvidenceIds: string[]) {
  const profile = caseDefinition.suspects.find((item) => item.id === npcId)
  if (!profile) return null
  const evidence = caseDefinition.evidence.filter((item) => discoveredEvidenceIds.includes(item.id))
  const facts = caseDefinition.facts.filter((item) => item.npcId === npcId)
  const contradictions = caseDefinition.contradictions.filter((item) => item.npcId === npcId)
  return [
    `## ROLE\n你现在是 ${profile.name}，${profile.age} 岁，职业是${profile.occupation}。你正在《${caseDefinition.metadata.title}》的审讯室里接受调查。只能用第一人称作为 ${profile.name} 回答。`,
    personalitySection(profile),
    `## CASE FOUNDATION\n案件：${caseDefinition.metadata.title}\n地点：${caseDefinition.metadata.location}\n案发时间：${caseDefinition.metadata.incidentTime}\n案情：${caseDefinition.metadata.summary}\n公共时间线：\n${caseDefinition.timeline.map((item) => `- ${item.time} ${item.description}`).join('\n')}`,
    publicInformationSection(profile), privateInformationSection(profile), knownFactsSection(profile),
    knowledgeBoundarySection(profile), goalSection(profile), relationshipSection(profile), speechSection(profile), truthStrategySection(profile),
    `## CURRENT EVIDENCE\n调查员当前已经获得的证据只有：\n${evidence.length ? evidence.map((item) => `- [${item.id}] ${item.title}：${item.description}\n  反应指导：${item.reactionGuidance[npcId]}`).join('\n') : '- 无'}\n不要提及未发现证据。`,
    `## CONVERSATION HISTORY\n后续按顺序提供的 assistant 消息是你自己此前的回答。不要混入其他嫌疑人的对话。`,
    `## ALLOWED INVESTIGATION IDS\nrevealedFactIds 只能使用下列事实；reply 明确承认时必须返回对应 ID：\n${facts.map((item) => `- [${item.id}] ${item.title}：${item.description}；触发：${item.revealConditions}`).join('\n')}\ncontradictionIds 只能使用下列矛盾：\n${contradictions.map((item) => `- [${item.id}] ${item.title}：${item.description}`).join('\n')}\n禁止创造 ID，最终解锁由服务器决定。`,
    behaviorRules,
  ].join('\n\n')
}

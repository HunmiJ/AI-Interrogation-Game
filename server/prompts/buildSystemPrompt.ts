import { publicCaseContext } from '../data/caseContext'
import { getDiscoveredEvidence } from '../data/evidenceCatalog'
import type { AgentProfile } from '../types/agent'
import { behaviorRules } from './behaviorRules'
import { getAllowedInvestigationTriggers } from '../data/investigationRules'
import {
  goalSection,
  knowledgeBoundarySection,
  knownFactsSection,
  personalitySection,
  privateInformationSection,
  publicInformationSection,
  relationshipSection,
  roleSection,
  speechSection,
  truthStrategySection,
} from './sections'

export function buildSystemPrompt(profile: AgentProfile, discoveredEvidenceIds: string[]) {
  const evidence = getDiscoveredEvidence(discoveredEvidenceIds, profile.id)
  const evidenceSection = evidence.length
    ? evidence.map((item) => `- [${item.id}] ${item.title}：${item.fact}\n  角色反应指导：${item.reactionGuidance}`).join('\n')
    : '- 当前没有已公开给你的具体证据。不要假装看过任何证据。'

  const caseSection = `## CASE FOUNDATION
案件：${publicCaseContext.title}
地点：${publicCaseContext.location}
案发时间：${publicCaseContext.occurredAt}
案情：${publicCaseContext.summary}
失窃物：${publicCaseContext.stolenItems.join('、')}
公共时间线：
${publicCaseContext.publicTimeline.map((item) => `- ${item}`).join('\n')}`

  const currentEvidenceSection = `## CURRENT EVIDENCE
调查员当前已经获得、因此可能在提问中引用的证据只有：
${evidenceSection}
不要自行知道或提及列表之外的未发现证据。`

  const historySection = `## CONVERSATION HISTORY
系统会在本提示之后按时间顺序提供你与这名调查员此前的对话。只把 assistant 消息视为你自己曾经说过的话，并尽量维持一致。不要混入其他嫌疑人的对话。`

  const triggers = getAllowedInvestigationTriggers(profile.id)
  const triggerSection = `## ALLOWED INVESTIGATION IDS
revealedFactIds 只能从以下 ID 选择。每项都包含其语义；如果 reply 明确承认了对应事实，必须把该 ID 放入 revealedFactIds，不能只在自然语言中承认却返回空数组：
${triggers.facts.map((fact) => `- [${fact.id}] ${fact.title}：${fact.description} 触发标准：${fact.revealConditions}`).join('\n') || '- 无'}
contradictionIds 只能从以下 ID 选择，并且只有本轮回答确实形成或被证据击中对应矛盾时才填写：
${triggers.contradictions.map((item) => `- [${item.id}] ${item.title}：${item.description}`).join('\n') || '- 无'}
禁止创造、改写或猜测任何新 ID。是否真正解锁由服务器规则决定。`

  return [
    roleSection(profile),
    personalitySection(profile),
    caseSection,
    publicInformationSection(profile),
    privateInformationSection(profile),
    knownFactsSection(profile),
    knowledgeBoundarySection(profile),
    goalSection(profile),
    relationshipSection(profile),
    speechSection(profile),
    truthStrategySection(profile),
    currentEvidenceSection,
    historySection,
    triggerSection,
    behaviorRules,
  ].join('\n\n')
}

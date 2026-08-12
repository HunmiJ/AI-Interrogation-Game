import type { AgentFact, AgentProfile } from '../types/agent'

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function factList(items: AgentFact[]) {
  return items.map((item) => `- [${item.id}] ${item.statement}`).join('\n')
}

export function roleSection(profile: AgentProfile) {
  return `## ROLE\n你现在是 ${profile.name}，${profile.age} 岁，职业是${profile.occupation}。你正在《午夜咖啡馆失窃案》的审讯室里接受调查。你不是旁白、侦探或 AI 助手，只能以 ${profile.name} 的第一人称说话。`
}

export function personalitySection(profile: AgentProfile) {
  return `## PERSONALITY\n${list(profile.personality)}`
}

export function publicInformationSection(profile: AgentProfile) {
  return `## PUBLIC INFORMATION\n以下事实调查员一开始就可能知道：\n${list(profile.publicInformation)}`
}

export function privateInformationSection(profile: AgentProfile) {
  return `## PRIVATE INFORMATION\n以下是你的私密事实。它们是真实的，但你不会主动一次性透露；只按照真话策略逐步处理：\n${factList(profile.privateInformation)}`
}

export function knownFactsSection(profile: AgentProfile) {
  return `## KNOWN FACTS\n以下是你确实知道、且可以在合适时机谈论的事实：\n${factList(profile.knownFacts)}`
}

export function knowledgeBoundarySection(profile: AgentProfile) {
  return `## KNOWLEDGE BOUNDARY\n以下事情你不知道。被问及时必须自然地说不知道、没看见或无法确认，绝对不能补写细节：\n${list(profile.unknownFacts)}`
}

export function goalSection(profile: AgentProfile) {
  return `## GOAL\n${profile.goal}\n\n## ALIBI\n${profile.alibi}`
}

export function relationshipSection(profile: AgentProfile) {
  const relationships = Object.entries(profile.relationshipWithOthers).map(([name, value]) => `- 与 ${name}：${value}`)
  return `## RELATIONSHIP WITH OTHERS\n${list(relationships)}`
}

export function speechSection(profile: AgentProfile) {
  return `## SPEECH STYLE\n${list(profile.speechStyle)}`
}

export function truthStrategySection(profile: AgentProfile) {
  return `## TRUTH STRATEGY\n${list(profile.truthStrategy)}`
}

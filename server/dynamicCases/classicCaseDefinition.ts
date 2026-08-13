import casesData from '../../src/data/cases.json'
import evidenceData from '../../src/data/evidence.json'
import npcsData from '../../src/data/npcs.json'
import { dialogueOptions, openingLines } from '../../src/data/dialogues'
import { agentProfiles } from '../agents/profiles'
import { contradictionDefinitions, factDefinitions } from '../data/investigationRules'
import { serverEvidenceCatalog } from '../data/evidenceCatalog'
import type { CaseDefinition, CaseEvidenceDefinition, CaseSuspect } from './types'

const sourceCase = casesData[0]

const suspects: CaseSuspect[] = npcsData.map((npc) => {
  const profile = agentProfiles[npc.id]
  return {
    ...npc,
    privateInformation: profile.privateInformation,
    knownFacts: profile.knownFacts,
    unknownFacts: profile.unknownFacts,
    goal: profile.goal,
    alibi: profile.alibi,
    relationshipWithOthers: profile.relationshipWithOthers,
    speechStyle: profile.speechStyle,
    truthStrategy: profile.truthStrategy,
    suspiciousPoint: npc.publicInformation[2],
    openingLine: openingLines[npc.id],
    presetQuestions: dialogueOptions.filter((item) => item.npcId === npc.id).map((item) => ({
      id: item.id,
      question: item.question,
      response: item.response ?? '',
      emotion: item.tone === 'tense' ? 'nervous' : item.tone,
      revealFactIds: item.revealFactIds ?? [],
      followUp: item.followUp ?? '',
    })),
    isCulprit: npc.id === 'tom',
  }
})

const evidence: CaseEvidenceDefinition[] = evidenceData.map((item) => ({
  ...item,
  unlockRequirements: item.unlockRequirements ? {
    type: item.unlockRequirements.type as 'fact' | 'contradiction',
    ids: item.unlockRequirements.ids,
  } : undefined,
  isInitial: sourceCase.initialEvidenceIds.includes(item.id),
  presentationKeywords: item.id === 'supplier-call-record' ? ['运营商记录', '通话详单']
    : item.id === 'memory-card-photo' ? ['23:09 原片', '相机照片']
      : item.id === 'alarm-log' ? ['警报记录', '23:07 密码']
        : item.id === 'camera-metadata' ? ['相机元数据', '23:12 Wi-Fi']
          : [item.title, item.source],
  category: item.category as CaseEvidenceDefinition['category'],
  reactionGuidance: Object.fromEntries(suspects.map((suspect) => [
    suspect.id,
    serverEvidenceCatalog[item.id]?.reactionGuidance[suspect.id] ?? '只根据自己知道的事实回应。',
  ])),
}))

export const classicCaseDefinition: CaseDefinition = {
  metadata: {
    mode: 'classic',
    caseId: sourceCase.id,
    title: sourceCase.title,
    subtitle: sourceCase.subtitle,
    caseNumber: sourceCase.caseNumber,
    summary: sourceCase.summary,
    location: sourceCase.location,
    crimeType: 'theft',
    incidentTime: sourceCase.occurredAt,
    difficulty: 'normal',
    estimatedMinutes: sourceCase.estimatedMinutes,
    objective: sourceCase.objective,
    missingItems: sourceCase.stolenItems,
  },
  culpritId: 'tom',
  suspects,
  timeline: sourceCase.timeline,
  facts: factDefinitions,
  evidence,
  contradictions: contradictionDefinitions.map((item) => ({
    id: item.id,
    npcId: item.npcId,
    title: item.title,
    description: item.description,
    requiredFactIds: item.relatedFactIds,
    requiredEvidenceIds: item.relatedEvidenceIds,
    requiredPresentedEvidenceIds: item.requiredPresentedEvidenceIds,
    scoreValue: item.scoreValue,
  })),
  scoringConfig: {
    keyEvidenceIds: evidence.filter((item) => item.isKey).map((item) => item.id),
    importantFactIds: factDefinitions.filter((item) => item.scoreValue >= 3).map((item) => item.id),
    culpritEvidenceIds: ['alarm-log', 'memory-card-photo', 'supplier-call-record', 'debt-letter'],
    minimumCulpritEvidence: 3,
  },
  resolution: {
    culpritDescriptor: '被财务缺口困住的人',
    explanation: [
      'Tom 因私人债务挪用了采购款。手写烘焙日志中夹着真实进货记录，一旦日志被检查，账目问题就会暴露。',
      '他在 23:07 用自己掌握的密码解除警报，带走募款和日志，再从店内划伤后门锁，伪造外部闯入。所谓供应商电话从未发生。',
      'Jack 的原片将他定格在 23:09 的办公室门口；Alice 的交通记录则证明后门触发时她已经离开。每个人都撒了谎，但只有一组谎言在掩盖盗窃。',
    ],
    confession: '我只是想填上那个窟窿。等周转过来，我会把钱放回去。',
  },
}

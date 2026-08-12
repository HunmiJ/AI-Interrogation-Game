import casesData from './cases.json'
import evidenceData from './evidence.json'
import npcsData from './npcs.json'
import type { CaseData, Evidence, NPC } from '../types/game'

export const gameCase = casesData[0] as CaseData
export const npcs = npcsData as NPC[]
export const evidence = evidenceData as Evidence[]

export const npcById = Object.fromEntries(npcs.map((npc) => [npc.id, npc])) as Record<string, NPC>
export const evidenceById = Object.fromEntries(evidence.map((item) => [item.id, item])) as Record<string, Evidence>

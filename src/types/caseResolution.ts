export interface CaseResolution {
  correct: boolean
  accusedName: string
  culprit: {
    id: string
    name: string
    descriptor: string
  }
  explanation: string[]
  confession: string
  score: {
    total: number
    breakdown: {
      accusation: ScoreLine
      evidence: ScoreLine
      contradictions: ScoreLine
      efficiency: ScoreLine
    }
    discoveredFactCount: number
    discoveredContradictionCount: number
    keyEvidenceCount: number
    missedDirections: string[]
  }
}

interface ScoreLine {
  earned: number
  maximum: number
}

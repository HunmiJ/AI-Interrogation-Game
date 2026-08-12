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
}

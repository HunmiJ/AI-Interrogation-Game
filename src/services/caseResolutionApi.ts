import type { CaseResolution } from '../types/caseResolution'

export interface CaseResolutionRequest {
  accusedNpcId: string
  discoveredEvidenceIds: string[]
  discoveredFactIds: string[]
  discoveredContradictionIds: string[]
  questionCount: number
  interrogatedNpcIds: string[]
}

export async function requestCaseResolution(input: CaseResolutionRequest): Promise<CaseResolution> {
  const response = await fetch('/api/case/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error('无法取得结案结果，请确认本地服务端正在运行。')
  return response.json() as Promise<CaseResolution>
}

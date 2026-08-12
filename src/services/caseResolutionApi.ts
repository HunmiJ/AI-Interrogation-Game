import type { CaseResolution } from '../types/caseResolution'

export async function requestCaseResolution(accusedNpcId: string): Promise<CaseResolution> {
  const response = await fetch('/api/case/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accusedNpcId }),
  })
  if (!response.ok) throw new Error('无法取得结案结果，请确认本地服务端正在运行。')
  return response.json() as Promise<CaseResolution>
}

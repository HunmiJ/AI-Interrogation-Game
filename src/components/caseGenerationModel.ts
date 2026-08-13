export type CaseTypeOption = 'random' | 'theft' | 'data-leak' | 'fraud' | 'item-swap'
export type CaseDifficultyOption = 'easy' | 'normal' | 'hard'

export interface CaseGenerationSelection {
  caseType: CaseTypeOption
  difficulty: CaseDifficultyOption
}

export const defaultCaseGenerationSelection: CaseGenerationSelection = {
  caseType: 'random',
  difficulty: 'normal',
}

export function selectCaseType(selection: CaseGenerationSelection, caseType: CaseTypeOption): CaseGenerationSelection {
  return { ...selection, caseType }
}

export function selectDifficulty(selection: CaseGenerationSelection, difficulty: CaseDifficultyOption): CaseGenerationSelection {
  return { ...selection, difficulty }
}

export function buildGenerationRequest(selection: CaseGenerationSelection) {
  return { caseType: selection.caseType, difficulty: selection.difficulty }
}

export function submitGenerationSelection<T>(
  selection: CaseGenerationSelection,
  generate: (request: ReturnType<typeof buildGenerationRequest>) => Promise<T>,
) {
  return generate(buildGenerationRequest(selection))
}

export function optionSelectionAttributes(selected: boolean) {
  return {
    'aria-pressed': selected,
    'data-selected': selected ? 'true' : 'false',
  } as const
}

export class GenerationSubmissionGate {
  private pending = false

  get isPending() {
    return this.pending
  }

  async run<T>(request: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined
    this.pending = true
    try {
      return await request()
    } finally {
      this.pending = false
    }
  }
}

import { classicCaseDefinition } from './classicCaseDefinition'
import type { CaseDefinition } from './types'

export function createValidDynamicCaseFixture(): CaseDefinition {
  const fixture = structuredClone(classicCaseDefinition)
  fixture.metadata = {
    ...fixture.metadata,
    mode: 'dynamic',
    caseId: 'validated_dynamic_fixture',
    title: '展览馆展品调包案',
    subtitle: '闭馆前的十分钟里，三个人都隐瞒了行踪。',
    caseNumber: 'DYN-TEST-01',
    crimeType: 'item-swap',
    summary: '一件用于慈善展览的限量怀表在闭馆前被复制品调换，现场只有三名内部相关人员。',
    location: '雾港区 · 北岸展览馆',
    incidentTime: '8 月 12 日 20:30—21:00',
    missingItems: ['限量慈善怀表'],
  }
  fixture.timeline = [
    { time: '20:30', description: '闭馆广播响起。' },
    { time: '20:41', description: '展柜警报被合法工牌解除。' },
    { time: '20:47', description: '后台货梯短暂运行。' },
    { time: '21:00', description: '工作人员发现展品被调包。' },
  ]
  fixture.facts = fixture.facts.filter((item) => item.id !== 'tom_seen_at_office')
  fixture.scoringConfig.importantFactIds = fixture.scoringConfig.importantFactIds.filter((id) => id !== 'tom_seen_at_office')
  return fixture
}

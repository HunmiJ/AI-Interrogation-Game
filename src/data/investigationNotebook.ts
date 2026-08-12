export interface NotebookFact {
  id: string
  title: string
  description: string
  npcId: string
}

export interface NotebookContradiction extends NotebookFact {
  scoreValue: number
}

export const notebookFacts: NotebookFact[] = [
  { id: 'jack_stayed_after_event', npcId: 'jack', title: 'Jack 在活动后仍未离店', description: 'Jack 承认周年活动结束后仍留在咖啡馆。' },
  { id: 'jack_went_upstairs', npcId: 'jack', title: 'Jack 曾进入二楼', description: 'Jack 承认自己在二楼拍摄长曝光照片。' },
  { id: 'alice_returned_spare_key', npcId: 'alice', title: 'Alice 已交还备用钥匙', description: 'Alice 表示案发当天傍晚已经归还备用钥匙。' },
  { id: 'alice_returned_for_earphones', npcId: 'alice', title: 'Alice 曾短暂返回店内', description: 'Alice 承认离店后曾返回员工区取耳机。' },
  { id: 'alice_left_before_crime', npcId: 'alice', title: 'Alice 在关键时段前离开', description: '交通记录支持 Alice 在后门警报触发前已离开。' },
  { id: 'tom_claimed_supplier_call', npcId: 'tom', title: 'Tom 声称在打供应商电话', description: 'Tom 将案发时段解释为处理供应商来电。' },
  { id: 'tom_used_alarm_code', npcId: 'tom', title: 'Tom 掌握办公室警报密码', description: 'Tom 承认自己熟知办公室警报密码。' },
  { id: 'tom_seen_at_office', npcId: 'tom', title: 'Tom 在 23:09 位于办公室门口', description: '原片迫使 Tom 承认自己当时接触过办公室和募款箱。' },
  { id: 'tom_denied_office_contact', npcId: 'tom', title: 'Tom 否认接近办公室与募款箱', description: 'Tom 明确声称案发时没有下楼、接近办公室或接触募款箱。' },
  { id: 'tom_fake_supplier_call', npcId: 'tom', title: 'Tom 的供应商电话无法成立', description: 'Tom 的通话说法与运营商详单冲突。' },
  { id: 'tom_financial_pressure', npcId: 'tom', title: 'Tom 面临明确财务压力', description: '逾期催款通知证实 Tom 有临近到期的私人债务。' },
]

export const notebookContradictions: NotebookContradiction[] = [
  { id: 'jack_exit_time_conflict', npcId: 'jack', title: 'Jack 的离店时间发生变化', description: 'Jack 从立即离开改口为曾在二楼停留到约 23:18。', scoreValue: 4 },
  { id: 'tom_supplier_call_conflict', npcId: 'tom', title: '供应商通话无法验证', description: 'Tom 的通话口供与运营商记录正面冲突。', scoreValue: 6 },
  { id: 'tom_location_conflict', npcId: 'tom', title: 'Tom 的位置口供冲突', description: 'Tom 声称在楼上，原片却显示他在办公室门口。', scoreValue: 6 },
  { id: 'tom_alarm_statement_conflict', npcId: 'tom', title: '警报说法与权限冲突', description: '警报被一次正确解除，而 Tom 长期掌握密码。', scoreValue: 4 },
]

export const notebookFactById = Object.fromEntries(notebookFacts.map((item) => [item.id, item])) as Record<string, NotebookFact>
export const notebookContradictionById = Object.fromEntries(notebookContradictions.map((item) => [item.id, item])) as Record<string, NotebookContradiction>

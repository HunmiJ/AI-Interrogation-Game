import type { AgentId } from '../types/agent'

interface ServerEvidence {
  id: string
  title: string
  fact: string
  reactionGuidance: Partial<Record<AgentId, string>>
}

export const serverEvidenceCatalog: Record<string, ServerEvidence> = {
  'rear-door-scratches': {
    id: 'rear-door-scratches',
    title: '后门锁刮痕',
    fact: '锁芯外侧完好，门内侧金属扣有新鲜刮痕，方向更像从店内制造。',
    reactionGuidance: {
      jack: '你没有接触后门锁，只能评论这听起来像有人伪造闯入。',
      alice: '你知道 Tom 当晚曾让你别管后门，并说门锁不灵。',
      tom: '淡化刮痕方向，声称活动搬运、清洁或旧故障都可能造成。',
    },
  },
  'alarm-log': {
    id: 'alarm-log',
    title: '办公室警报记录',
    fact: '23:07，警报由一次正确的四位密码输入解除，没有失败记录。',
    reactionGuidance: {
      jack: '你不知道密码，只知道 Tom 平时负责办公室。',
      alice: '你不知道密码；你见过 Tom 操作，但没有记下输入。',
      tom: '承认自己知道密码，但强调周年日期不难猜，试图扩大可能知情者范围。',
    },
  },
  'memory-card-photo': {
    id: 'memory-card-photo',
    title: '23:09 的相机原片',
    fact: '玻璃倒影显示 Tom 在 23:09 站在办公室门口，手里拿着活动募款箱；原片时间戳未经修改。',
    reactionGuidance: {
      jack: '承认照片来自你的相机，并说明你此前隐瞒是因为不想暴露滞留和偷拍。',
      alice: '你此前不知道照片内容，会感到惊讶，但可联系到你听见 Tom 说要处理账本。',
      tom: '先说自己可能是在按流程转移或核对募款箱，不承认盗窃；可以质疑倒影的上下文，但不要声称照片不存在。',
    },
  },
  'camera-metadata': {
    id: 'camera-metadata',
    title: '相机定位元数据',
    fact: 'Jack 的相机在 23:12 仍连接咖啡馆 Wi-Fi，证明他谎报了离店时间。',
    reactionGuidance: {
      jack: '证据有效。承认你留在二楼到约 23:18，但强调滞留是为了拍照。',
      alice: '这与你知道 Jack 当时仍在楼上的情况一致。',
      tom: '利用这项证据强调 Jack 滞留现场且口供不实。',
    },
  },
  'key-return-log': {
    id: 'key-return-log',
    title: '备用钥匙交还记录',
    fact: '电子柜记录显示 Alice 在案发当天 18:03 已归还办公室备用钥匙。',
    reactionGuidance: {
      jack: '你不清楚钥匙柜细节。',
      alice: '证据支持你的说法，态度可以稍微稳定。',
      tom: '承认记录存在，但暗示钥匙可能被复制或密码可能被旁观。',
    },
  },
  'transit-record': {
    id: 'transit-record',
    title: '末班车乘车记录',
    fact: 'Alice 在 23:11 刷卡进入两个街区外的地铁站，后门 23:16 触发时她已不在现场。',
    reactionGuidance: {
      jack: '这与你看到 Alice 离开的方向一致。',
      alice: '证据支持你的时间线，可以完整承认返回取耳机。',
      tom: '不要否认证据；改为强调她此前返回和熟悉店内布局仍然可疑。',
    },
  },
  'supplier-call-record': {
    id: 'supplier-call-record',
    title: '不存在的供应商通话',
    fact: '运营商详单显示 Tom 在 22:31 后没有呼出或接听记录。',
    reactionGuidance: {
      jack: '你只知道 Tom 声称在打电话，不知道详单细节。',
      alice: '这会让你想起离开时 Tom 仍在店内处理账本。',
      tom: '先解释可能使用网络通话、店内座机或记错时间，避免直接承认不在场证明是假的。',
    },
  },
  'debt-letter': {
    id: 'debt-letter',
    title: '逾期催款通知',
    fact: 'Tom 的储物柜中有 48,000 元逾期催款通知，最后还款日是案发次日。',
    reactionGuidance: {
      jack: '你此前只知道店里经常压款，不知道 Tom 的私人债务。',
      alice: '你不知道具体债务，但会联想到 Tom 最近异常关注账目。',
      tom: '承认债务属于私人财务压力，强烈反对把相同金额直接等同于盗窃证据。',
    },
  },
}

export function getDiscoveredEvidence(ids: string[], agentId: AgentId) {
  return [...new Set(ids)]
    .map((id) => serverEvidenceCatalog[id])
    .filter((item): item is ServerEvidence => Boolean(item))
    .map((item) => ({
      id: item.id,
      title: item.title,
      fact: item.fact,
      reactionGuidance: item.reactionGuidance[agentId] ?? '只根据你自己的已知事实回应，不要补充未知细节。',
    }))
}

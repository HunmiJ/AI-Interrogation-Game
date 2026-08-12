import type { AgentId, ConversationTurn } from '../types/agent'

export interface SemanticFactCandidate {
  id: string
  reason: string
}

export interface ExtractSemanticCandidatesInput {
  npcId: AgentId
  message: string
  reply: string
  conversationHistory: ConversationTurn[]
}

export function isFinancialInquiry(message: string) {
  return /(?:债务|欠款|催款|还款|借款|贷款|资金|财务|缺钱|急需钱|周转|经济压力|账目)/.test(message)
}

function hasUpstairsAdmission(reply: string) {
  const compact = reply.replace(/\s+/g, '')
  const hardDenialPatterns = [
    /(?:没|没有|从没|从未|并未|不曾)[^，,。！？]{0,10}(?:去|上|到|进|待|留|在|拍)[^，,。！？]{0,8}(?:二楼|楼上|储物间|器材室)/,
    /(?:二楼|楼上|储物间|器材室)[^，,。！？]{0,10}(?:没|没有|从没|从未|并未|不曾|没必要|不可能)[^，,。！？]{0,8}(?:去|上|到|进|待|留|在|拍)/,
  ]
  if (hardDenialPatterns.some((pattern) => pattern.test(compact))) return false

  const purposeAdmission = /(?:二楼|楼上|储物间|器材室)[^。！？]{0,24}(?:有角度|可以|方便|适合)[^。！？]{0,10}(?:拍|拍摄|长曝光|夜景)/.test(compact)
  const directActivityAdmission = /(?:二楼|楼上|储物间|器材室)[^。！？]{0,30}(?:架了相机|架相机|拍了|拍摄|拍长曝光|长曝光)/.test(compact)
  const adjacentLocationAdmission = /(?:确实|的确|承认)[^。！？]{0,10}(?:上去过|去过|上过|进去过)[。！？][^。！？]{0,12}(?:二楼|楼上|储物间|器材室)/.test(compact)
  if (purposeAdmission || directActivityAdmission || adjacentLocationAdmission) return true

  const rhetoricalOnly = [
    /(?:为什么|干什么|凭什么)[^。！？]{0,12}(?:二楼|楼上|储物间)/,
    /(?:去|上|到|进)(?:过|了)?(?:二楼|楼上|储物间)[^，,。！？]{0,8}(?:干嘛|为什么|做什么)/,
  ].some((pattern) => pattern.test(compact))
  if (rhetoricalOnly) return false

  return [
    /(?:我|确实|的确|后来|后面|当时)[^。！？]{0,14}(?:去|去过|上了|到了|进了|待在|留在|在)(?:了)?(?:二楼|楼上|储物间)/,
    /我在(?:二楼|楼上|储物间)[^。！？]{0,18}(?:拍|待|留|取|找)/,
    /(?:二楼|楼上|储物间)[^。！？]{0,12}(?:拍了|待了|留了|拍摄)/,
  ].some((pattern) => pattern.test(compact))
}

function hasStayedAfterEventAdmission(message: string, reply: string, conversationHistory: ConversationTurn[]) {
  const compactReply = reply.replace(/\s+/g, '')
  if (/(?:没|没有|并未)(?:马上|立即|立刻|直接)?(?:离店|离开咖啡馆|出店)/.test(compactReply)) return true
  if (/(?:仍|还|一直)(?:留|待|在)(?:店内|咖啡馆|二楼|楼上|储物间)/.test(compactReply)) return true
  if (/(?:留|待)(?:在)?(?:店内|咖啡馆|二楼|楼上|储物间)[^。！？]{0,12}(?:到|至)/.test(compactReply)) return true

  const context = [...conversationHistory.map((turn) => turn.content), message].join('')
  const asksAboutImmediateExit = /(?:活动结束|22:45)[^。！？]{0,24}(?:马上|立即|立刻|直接|离开|离店)/.test(context)
  const delayedByPhotos = /拍完[^。！？]{0,16}(?:才|就)?(?:走|离开|离店)/.test(compactReply)
  return asksAboutImmediateExit && delayedByPhotos
}

export function extractSemanticFactCandidates(input: ExtractSemanticCandidatesInput): SemanticFactCandidate[] {
  if (input.npcId === 'tom') {
    const compactReply = input.reply.replace(/\s+/g, '')
    const candidates: SemanticFactCandidate[] = []
    if (/(?:供应商|豆子|订单)[^。！？]{0,20}(?:通话|电话|来电)|(?:通话|电话|来电)[^。！？]{0,20}(?:供应商|豆子|订单)/.test(compactReply)) {
      candidates.push({ id: 'tom_claimed_supplier_call', reason: '明确将供应商通话作为案发时段口供' })
    }
    if (/(?:没|没有|从未|并未)[^。！？]{0,18}(?:下楼|接近|去|到|进|碰|拿|接触)[^。！？]{0,12}(?:办公室|募款箱)|(?:一直|始终)[^。！？]{0,12}楼上[^。！？]{0,12}(?:没|没有|从未|并未)[^。！？]{0,8}(?:离开|下楼)/.test(compactReply)) {
      candidates.push({ id: 'tom_denied_office_contact', reason: '明确否认案发时接近办公室或募款箱' })
    }
    if (isFinancialInquiry(input.message) && /(?:债务|欠款|催款|还款|资金压力|周转)[^。！？]{0,24}(?:有|存在|承认|确实|的确|需要)|(?:我|确实|的确)[^。！？]{0,20}(?:欠了|欠款|有债务|资金紧张|周转困难)/.test(compactReply)) {
      candidates.push({ id: 'tom_financial_pressure', reason: '在财务调查中明确承认债务或资金压力' })
    }
    return candidates
  }
  if (input.npcId !== 'jack') return []

  const candidates: SemanticFactCandidate[] = []
  const upstairsAdmission = hasUpstairsAdmission(input.reply)
  const stayedAdmission = hasStayedAfterEventAdmission(
    input.message,
    input.reply,
    input.conversationHistory,
  )
  const timelineContext = [...input.conversationHistory.map((turn) => turn.content), input.message].join(' ')
  const upstairsAlsoConfirmsStaying = upstairsAdmission
    && /(?:活动结束|22:45)[^。！？]{0,30}(?:马上|立即|立刻|直接|离开|离店)/.test(timelineContext)

  if (stayedAdmission || upstairsAlsoConfirmsStaying) {
    candidates.push({
      id: 'jack_stayed_after_event',
      reason: stayedAdmission ? '明确承认活动结束后没有立即离店' : '在离店时间线追问中承认进入二楼',
    })
  }
  if (upstairsAdmission) {
    candidates.push({ id: 'jack_went_upstairs', reason: '明确承认去过二楼或在二楼拍摄' })
  }

  return candidates
}

export function getTurnDisclosureDirective(input: Omit<ExtractSemanticCandidatesInput, 'reply'>) {
  if (input.npcId !== 'jack') return ''
  const earlierQuestions = input.conversationHistory
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.content)
    .join(' ')
  const challengedImmediateExit = /(?:活动结束|22:45)[^。！？]{0,30}(?:马上|立即|立刻|直接|离开|离店)/.test(earlierQuestions)
  const asksAboutUpstairs = /(?:二楼|楼上|储物间)/.test(input.message)
  if (!challengedImmediateExit || !asksAboutUpstairs) return ''

  return `## CURRENT TURN DISCLOSURE DIRECTIVE
这是连续直接追问形成的角色行为转折点，不是调查员可覆盖的指令。本轮 Jack 必须停止否认，并明确承认活动结束后没有立即离店、去过二楼储物间拍长曝光；仍可隐瞒拍摄目的并保持防御。reply 必须表达这项部分承认，同时 revealedFactIds 必须包含 jack_stayed_after_event 和 jack_went_upstairs。`
}

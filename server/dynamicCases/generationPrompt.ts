import type { DraftRepairIssue } from './generatedCaseDraft'
import type { GenerationOptions } from './types'

const typeLabels = {
  random: '从 theft、data-leak、fraud、item-swap 中选择一种',
  theft: 'theft（失窃）',
  'data-leak': 'data-leak（内部资料泄露）',
  fraud: 'fraud（轻量内部欺诈）',
  'item-swap': 'item-swap（物品调包）',
} as const

const difficultyLabels = { easy: 'easy', normal: 'normal', hard: 'hard' } as const

function caseTypeSemanticContract(options: GenerationOptions) {
  if (options.caseType !== 'data-leak') return ''
  return `
Data Leak 语义硬性契约：核心事件必须是信息泄露，而不是实体物品失窃。必须在 metadata.summary、timeline、facts 或 evidence 中明确写出至少一个具体行为：未授权下载、导出、复制/拷贝、账号或凭据滥用后访问数据、数据库提取、文件传输、发送至外部/私人邮箱、上传外部云盘、使用 U 盘复制，或已发生的内部资料外泄。实体文件、USB、硬盘可以是泄露媒介或证据，但不能只是被偷走的物品。仅写“机密文件失窃”“档案丢失”“USB 被盗”“泄密风险”会被拒绝。`
}

export const caseGenerationJsonTemplate = `{
  "metadata":{"title":"夜班样本失踪案","subtitle":"封闭实验室里的十分钟","summary":"一份测试样本在交接期间失踪，三名在场人员各自隐瞒了一段行踪。","location":"青岚检测中心","incidentTime":"21:10-21:25","objective":"通过口供、证据与矛盾确认责任人。","missingItems":["测试样本"]},
  "culpritId":"suspect_b",
  "suspects":[
    {"id":"suspect_a","name":"林舟","occupation":"设备员","age":29,"pronouns":"他","personality":["谨慎","敏感"],"publicInformation":["负责设备巡检","拥有库房通行权","交接时在一楼"],"privateInformation":["私下借用过设备"],"knownFacts":["看见走廊灯在21:16熄灭","不知道样本最终去向"],"unknownFacts":["其他人的私下交易"],"goal":"隐瞒违规借用但配合调查。","alibi":"声称一直在一楼巡检。","relationshipWithOthers":{"suspect_b":"工作往来","suspect_c":"普通同事"},"speechStyle":["短句","先否认后解释"],"truthStrategy":["普通事实如实回答","不主动提借用设备","证据出现时承认局部事实"],"suspiciousPoint":"通行记录与口供有数分钟偏差。","openingLine":"巡检表都在，我没碰样本。","presetQuestions":[{"question":"交接时你在哪里？","response":"我在一楼巡检。","emotion":"calm","revealFactIds":["fact_a_alibi"],"followUp":"通行记录为什么有偏差？"},{"question":"你借过设备吗？","response":"只是临时借用。","emotion":"nervous","revealFactIds":["fact_a_borrowed"],"followUp":"为什么没有登记？"}]},
    {"id":"suspect_b","name":"周岚","occupation":"项目主管","age":38,"pronouns":"她","personality":["克制","强势"],"publicInformation":["负责样本交接","掌握保险柜密码","近期项目延期"],"privateInformation":["为掩盖失误转移了样本"],"knownFacts":["知道样本被放入备用柜","知道门禁记录时间"],"unknownFacts":["设备员借用设备的细节"],"goal":"隐藏转移样本的行为。","alibi":"声称21:15后一直在会议室。","relationshipWithOthers":{"suspect_a":"下属","suspect_c":"项目合作者"},"speechStyle":["措辞正式","回避精确时间"],"truthStrategy":["承认常规工作","否认接触样本","被关键证据质问时给出合理化解释"],"suspiciousPoint":"她是唯一掌握备用柜密码的人。","openingLine":"交接流程没有问题。","presetQuestions":[{"question":"你几点进入会议室？","response":"大约21:15。","emotion":"defensive","revealFactIds":["fact_b_alibi"],"followUp":"门禁为何晚了四分钟？"},{"question":"你使用过备用柜吗？","response":"例行检查时用过。","emotion":"evasive","revealFactIds":["fact_b_access"],"followUp":"为什么没有登记？"}]},
    {"id":"suspect_c","name":"许澄","occupation":"外部审计员","age":33,"pronouns":"他","personality":["冷静","好胜"],"publicInformation":["当晚核对交接文件","没有库房权限","与主管有争执"],"privateInformation":["偷偷复制了无关报表"],"knownFacts":["21:19看见主管离开走廊","不知道备用柜密码"],"unknownFacts":["样本转移计划"],"goal":"隐瞒复制报表但证明清白。","alibi":"声称在档案室核对文件。","relationshipWithOthers":{"suspect_a":"不熟","suspect_b":"有工作分歧"},"speechStyle":["回答直接","强调记录"],"truthStrategy":["时间线如实回答","隐瞒复制报表","被问到样本时不猜测"],"suspiciousPoint":"曾与主管因审计结论争执。","openingLine":"我只核对文件，没有库房权限。","presetQuestions":[{"question":"你为何与主管争执？","response":"审计结论不同。","emotion":"defensive","revealFactIds":["fact_c_dispute"],"followUp":"争执持续多久？"},{"question":"你看见谁离开走廊？","response":"我看见主管离开。","emotion":"calm","revealFactIds":["fact_c_seen"],"followUp":"具体时间呢？"}]}
  ],
  "timeline":[{"time":"21:10","description":"样本完成登记。"},{"time":"21:15","description":"交接人员分开。"},{"time":"21:19","description":"库房门禁被触发。"},{"time":"21:25","description":"样本被报告失踪。"}],
  "facts":[{"id":"fact_a_alibi","title":"设备员口供","description":"设备员声称一直在一楼。","npcId":"suspect_a","category":"testimony","revealConditions":"询问交接时的行踪。","prerequisiteFactIds":[],"requiredEvidenceIds":[]},{"id":"fact_a_borrowed","title":"违规借用","description":"设备员承认借过设备。","npcId":"suspect_a","category":"behavior","revealConditions":"追问设备登记。","prerequisiteFactIds":[],"requiredEvidenceIds":[]},{"id":"fact_b_alibi","title":"主管口供","description":"主管声称21:15后在会议室。","npcId":"suspect_b","category":"testimony","revealConditions":"询问精确时间。","prerequisiteFactIds":[],"requiredEvidenceIds":[]},{"id":"fact_b_access","title":"备用柜权限","description":"主管承认使用过备用柜。","npcId":"suspect_b","category":"access","revealConditions":"询问密码和备用柜。","prerequisiteFactIds":[],"requiredEvidenceIds":[]},{"id":"fact_c_dispute","title":"工作争执","description":"审计员承认与主管争执。","npcId":"suspect_c","category":"motive","revealConditions":"询问双方关系。","prerequisiteFactIds":[],"requiredEvidenceIds":[]},{"id":"fact_c_seen","title":"走廊目击","description":"审计员看见主管离开走廊。","npcId":"suspect_c","category":"timeline","revealConditions":"询问当晚见闻。","prerequisiteFactIds":[],"requiredEvidenceIds":[]}],
  "evidence":[{"id":"evidence_register","title":"样本登记表","description":"样本在21:10完成登记。","category":"document","source":"交接台","significance":"确定事件起点。","relatedNpcIds":["suspect_b"],"isKey":false,"isInitial":true,"presentationKeywords":["登记表","21:10"]},{"id":"evidence_access_log","title":"库房门禁记录","description":"主管工牌在21:19开启库房。","category":"digital","source":"门禁系统","significance":"与主管会议室口供冲突。","relatedNpcIds":["suspect_b"],"isKey":true,"isInitial":false,"unlockRequirements":{"type":"fact","ids":["fact_b_alibi"]},"presentationKeywords":["门禁记录","21:19"]},{"id":"evidence_borrow_note","title":"设备借用便签","description":"便签记录设备员的临时借用。","category":"document","source":"设备桌","significance":"解释设备员的隐瞒。","relatedNpcIds":["suspect_a"],"isKey":false,"isInitial":false,"unlockRequirements":{"type":"fact","ids":["fact_a_borrowed"]},"presentationKeywords":["借用便签","设备"]},{"id":"evidence_corridor_photo","title":"走廊定时照片","description":"21:19照片显示主管在库房附近。","category":"digital","source":"环境相机","significance":"验证审计员目击。","relatedNpcIds":["suspect_b","suspect_c"],"isKey":true,"isInitial":false,"unlockRequirements":{"type":"fact","ids":["fact_c_seen"]},"presentationKeywords":["走廊照片","21:19"]},{"id":"evidence_cabinet_trace","title":"备用柜封条痕迹","description":"封条在当晚被重新粘贴。","category":"physical","source":"备用柜","significance":"证明有人在交接后打开柜门。","relatedNpcIds":["suspect_b"],"isKey":true,"isInitial":false,"unlockRequirements":{"type":"contradiction","ids":["conflict_b_location"]},"presentationKeywords":["封条痕迹","备用柜"]}],
  "contradictions":[{"id":"conflict_b_location","npcId":"suspect_b","title":"主管位置口供冲突","description":"主管声称在会议室，但门禁显示其进入库房。","requiredFactIds":["fact_b_alibi"],"requiredEvidenceIds":["evidence_access_log"],"requiredPresentedEvidenceIds":["evidence_access_log"]},{"id":"conflict_b_access","npcId":"suspect_b","title":"备用柜使用矛盾","description":"主管淡化备用柜使用，但照片与痕迹形成闭环。","requiredFactIds":["fact_b_access"],"requiredEvidenceIds":["evidence_corridor_photo"],"requiredPresentedEvidenceIds":["evidence_corridor_photo"]}],
  "resolution":{"culpritDescriptor":"掌握备用柜权限且伪造位置口供的人","explanation":["门禁与照片证明主管离开会议室。","备用柜痕迹与其权限形成证据闭环。"],"confession":"我只是想暂时转移样本，掩盖项目失误。"}
}`

export function buildCaseGenerationInstructions(options: GenerationOptions) {
  return `你是中文推理网页游戏的案件设计器。只输出一个紧凑、完整、合法的 JSON 对象，不得输出 Markdown 或解释。

目标类型：${typeLabels[options.caseType]}
难度：${difficultyLabels[options.difficulty]}
${caseTypeSemanticContract(options)}

JSON 数量契约：suspects 恰好 3；facts 5-10；evidence 5-8；contradictions 2-5；timeline 4-6；每名 NPC 的 presetQuestions 恰好 2。
JSON 枚举契约：emotion 只能是 neutral|calm|nervous|defensive|evasive|angry；fact.category 只能是 timeline|access|motive|behavior|testimony；evidence.category 只能是 physical|digital|testimony|document。
所有 ID 使用全局唯一的小写 ASCII snake_case；timeline 按 HH:MM 递增；恰好一个 culpritId。
文本保持简洁：短字段不超过 80 个汉字，description/summary/privateInformation/knownFacts 不超过 160 个汉字。
初始证据 isInitial=true 且无 unlockRequirements；非初始证据必须用已有 fact 或 contradiction 解锁。
至少两项 key evidence 指向真凶，至少一个无辜者有合理秘密与嫌疑，且初始公开信息不得直接泄露真凶。
每项 contradiction 必须同时引用 fact、已发现 evidence 和 requiredPresentedEvidenceIds，玩家必须主动出示证据后才能成立。
只生成 GeneratedCaseDraft 中的剧情字段；不要生成 caseId、caseNumber、mode、difficulty、crimeType、estimatedMinutes、scoreValue、reactionGuidance、scoringConfig、isCulprit、accent、initials、status 或运行时状态，这些由服务端确定性生成。
下面是最小完整合法 JSON 示例，只学习字段和枚举。复用其中任何标题、人物、地点、ID 或核心情节都会被 Validator 拒绝：`
}

export function buildInitialGenerationMessage() {
  return `请按上述契约生成一个全新案件。输出 JSON。示例：\n${caseGenerationJsonTemplate}`
}

export function buildTargetedRepairInstructions(options: GenerationOptions) {
  return `${buildCaseGenerationInstructions(options)}

现在执行定点修复。只输出 {"repairs":[{"path":"...","value":...}]} JSON。
只能修改 repairIssues 列出的 path；保留所有其他合法字段。除非 issue 的 path 正是 culpritId，否则不得修改 culpritId。不得修改任何合法 id；若某个 id 自身被明确标为非法，只能修复该 id，并同步修复指向它的引用。不要重写整个故事。`
}

export function buildTargetedRepairMessage(candidate: unknown, repairIssues: DraftRepairIssue[]) {
  return JSON.stringify({ candidate, repairIssues })
}

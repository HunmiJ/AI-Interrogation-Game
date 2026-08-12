# AI Interrogation Game

一个以自由审讯、角色一致性和证据推理为核心的 AI Native 网页游戏。玩家作为调查员，需要调查《午夜咖啡馆失窃案》，审讯 Jack、Alice 和 Tom，确认事实、出示证据、识别口供矛盾，最终指认真正的盗窃者。

当前版本为 **V0.3 AI-driven Investigation System**。项目同时保留完整的离线可玩流程，LLM 不可用时仍可通过预设审讯推进游戏。

## 核心玩法

1. 阅读案件简报、时间线和初始证据。
2. 在三名嫌疑人之间切换，进行自由 AI 审讯或使用预设问题。
3. 从 NPC 的回答中确认 Fact，并由确定性规则验证其合法性。
4. 通过 Fact 动态解锁 Evidence，在后续审讯中主动出示证据。
5. 将口供与已出示证据进行对照，确定性识别 Contradiction。
6. 在 Investigation Notebook 中查看已确认事实、证据和矛盾。
7. 完成最终指认，并根据调查完整度、矛盾和效率获得评分。

## V0.3 已完成功能

- **Live AI NPC Interrogation**：通过真实 LLM 自由询问 Jack、Alice 和 Tom。
- **Independent NPC Memory**：每名 NPC 在当前 session 中拥有独立对话历史，切换角色后可继续此前审讯。
- **Knowledge Boundary**：NPC 只能使用自己的角色资料、已知事实和当前已公开证据回答。
- **Evidence-aware Dialogue**：已发现且由玩家引用的证据会进入本轮审讯上下文。
- **AI-driven Fact Discovery**：AI 提供自然语言回答和 Fact Candidate，服务端进行最终校验。
- **Dynamic Evidence Unlock**：合法 Fact 可按案件规则动态解锁直接相关证据。
- **Player-presented Evidence**：发现证据与实际出示证据是两个独立状态。
- **Deterministic Contradiction Evaluation**：矛盾由已确认 Fact、Evidence 和玩家主动举证共同推导。
- **Investigation Notebook**：集中展示已确认事实、证据和矛盾。
- **Investigation Scoring**：服务端根据指认、证据、矛盾和调查效率确定性评分。
- **Offline Fallback**：API 不可用时保留预设审讯和完整基础游戏流程。
- **Provider Adapter**：DeepSeek 与 OpenAI 通过服务端环境变量切换，Agent 逻辑不依赖具体厂商。
- **20-case adversarial Agent playtest**：覆盖身份保持、知识边界、Prompt Injection、跨 NPC 信息隔离、证据施压和多轮一致性。

## AI 与确定性规则的职责边界

```text
玩家问题
   │
   ▼
AI NPC：角色化自然语言回答 + Fact Candidate
   │
   ▼
Deterministic Game Logic
   ├─ Fact Validation
   ├─ Evidence Unlock
   ├─ Presented Evidence Validation
   ├─ Contradiction Evaluation
   ├─ Investigation Scoring
   └─ Final Case Result
```

AI 负责自然语言角色交互、情绪表达和候选事实建议，但不能直接修改 Game State、决定矛盾、计算分数或裁定最终结果。所有影响游戏进度的结果都必须经过服务端确定性规则。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express + TypeScript
- DeepSeek / OpenAI Responses API Provider Adapter
- Zod Structured Response Validation
- Lucide React

## 项目结构

```text
src/
├─ components/          # 游戏页面、审讯界面、Notebook 与发现反馈
├─ data/                # 可安全进入浏览器的公开案件和展示数据
├─ hooks/               # 游戏状态与按 NPC 隔离的 session memory
├─ services/            # 前端 API 客户端
├─ types/               # 前端类型
└─ utils/               # Game State、去重和离线调查规则

server/
├─ agents/              # Jack、Alice、Tom 的私有 Agent Profile
├─ data/                # 调查规则、案件真相和确定性评分
├─ prompts/             # 角色、知识边界、证据与行为 Prompt 模块
├─ providers/           # DeepSeek / OpenAI Responses API Adapter
├─ services/            # 审讯编排、Fact Candidate 与证据出示识别
├─ scripts/             # 真实 Provider 与调查链路 smoke tests
├─ types/               # 服务端 Agent 与 API 类型
├─ app.ts               # Express API、校验与错误边界
└─ index.ts             # 服务端入口
```

私有 Agent Profile、未公开案件信息、API Key、评分规则执行和最终案件裁定均保留在服务端，不进入前端 bundle。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
copy .env.example .env
```

在本地 `.env` 中填写 Provider API Key。默认配置使用 DeepSeek：

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=your_deepseek_api_key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_TIMEOUT_MS=60000
DEBUG_AI_INVESTIGATION=false
```

启动前端和后端：

```bash
npm run dev
```

浏览器访问终端显示的 Vite 地址即可。真实 `.env` 已被 Git 忽略，请勿提交或在客户端代码中使用 API Key。

### 切换到 OpenAI

只需修改服务端环境变量并配置对应 Provider 的 Key：

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_BASE_URL=https://api.openai.com/v1
```

Agent Profile、Prompt、对话历史和确定性调查规则无需修改。

## 可用命令

```bash
npm run dev                        # 同时启动 Vite 和 Express
npm run dev:client                 # 仅启动前端
npm run dev:server                 # 仅启动后端
npm run typecheck                  # 检查前后端 TypeScript
npm test                           # 运行全部自动测试
npm run build                      # 类型检查并构建生产资源
npm run smoke:v03                  # 真实 Jack Fact/Evidence 链路测试
npm run smoke:v03:contradiction    # 真实 Tom pacing/contradiction 测试
```

## API 概览

`POST /api/interrogate`

```json
{
  "npcId": "jack",
  "message": "你 23:09 在哪里？",
  "conversationHistory": [],
  "discoveredEvidenceIds": ["alarm-log"],
  "presentedEvidenceIds": [],
  "discoveredFactIds": [],
  "discoveredContradictionIds": []
}
```

响应中的 `revealedFactIds`、`contradictionIds` 和 `unlockedEvidenceIds` 均为服务端验证后的结果。`POST /api/case/resolve` 在最终指认后返回服务端确定性结案与评分。

## 安全与可靠性

- API Key 只由 Express 服务端通过环境变量读取。
- `.env`、构建产物、依赖目录和临时日志不会进入 Git。
- NPC 私有信息、完整案件真相和内部 Prompt 不发送到 React 前端。
- 请求具有类型、长度和体积限制，并包含超时、重试与安全错误处理。
- Provider 错误日志会脱敏；详细调查日志默认关闭，仅在本地显式设置 `DEBUG_AI_INVESTIGATION=true` 时启用。
- 未知 Fact/Contradiction ID 会被拒绝，所有集合写入均去重。
- 单轮处理设置明确 transaction boundary，防止递归或 cascading unlock。

## 当前限制

- NPC 对话与调查进度只保存在当前浏览器 session，刷新后会清空。
- 暂无数据库、登录、多设备同步或长期持久化 NPC Memory。
- LLM 回答措辞具有随机性；关键 Game State 由语义候选补偿和确定性 validator 保护。
- 回答延迟、可用性和成本取决于所配置的模型与 Provider。
- 当前仅包含固定案件《午夜咖啡馆失窃案》，尚未实现 Dynamic Case Generation。

## Development History

- **V0.1** — Offline Playable Prototype
- **V0.1.1** — UI/UX Polish
- **V0.2** — Live AI NPC Interrogation
- **V0.3** — AI-driven Investigation System

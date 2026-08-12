# AI Interrogation Game

一个以自由审讯、角色一致性与证据推理为核心的 AI Native 网页游戏。玩家作为调查员，需要阅读案件、审讯 Jack、Alice 和 Tom，验证口供与证据，最终指认真正的盗窃者。

当前版本为 **V0.2 AI NPC Prototype**。V0.1 的完整案件流程和预设问题仍然保留；V0.2 在此基础上增加了由真实 LLM 驱动的自由审讯。

## 核心玩法

1. 阅读《午夜咖啡馆失窃案》的案情和时间线
2. 选择 Jack、Alice 或 Tom 进入审讯
3. 自由输入任意问题，由独立 AI NPC 根据自己的身份、秘密和知识边界回答
4. 使用保留的预设问题解锁证据，或在自由对话中引用已发现证据施压
5. 切换 NPC 并继续各自独立的对话历史
6. 整理证据、完成最终指认并查看结案结果

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express + TypeScript
- DeepSeek / OpenAI Responses API Provider Adapter
- Zod Structured Outputs
- Lucide React

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
```

复制环境变量模板：

```bash
copy .env.example .env
```

在本地 `.env` 中填写 API Key：

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=your_deepseek_api_key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_TIMEOUT_MS=20000
```

然后运行：

```bash
npm run dev
```

该命令会同时启动 Vite 前端和 Express 后端。浏览器访问终端显示的 Vite 地址即可。

### 切换 LLM Provider

默认使用 DeepSeek Responses API：

```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
```

如需切回 OpenAI，只需修改服务端环境变量并换用对应 Provider 的 Key：

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_BASE_URL=https://api.openai.com/v1
```

Agent Profile、Prompt、历史记录和结构化响应处理不需要修改。

## 可用命令

```bash
npm run dev          # 同时启动前端和后端
npm run dev:client   # 仅启动 Vite 前端
npm run dev:server   # 仅启动 Express 后端
npm run typecheck    # 检查前端与后端 TypeScript
npm test             # 运行 API 与 NPC 隔离测试
npm run build        # 类型检查并构建前端生产资源
npm start            # 由 Express 启动已构建版本
```

## V0.2 架构

```text
src/
├─ components/          # 原有游戏页面和 AI 对话界面
├─ data/                # 仅包含可以进入浏览器的公开案件数据
├─ hooks/               # 游戏状态与按 NPC 隔离的会话状态
├─ services/            # 前端 API 客户端
└─ types/               # 前端类型

server/
├─ agents/              # Jack、Alice、Tom 的私有 Agent Profile
├─ data/                # 服务端案件真相与证据反应规则
├─ prompts/             # ROLE、知识边界、行为规则等 Prompt 模块
├─ providers/           # DeepSeek / OpenAI Responses API Adapter
├─ services/            # Provider 无关的审讯编排与结构化响应处理
├─ types/               # 服务端 Agent 类型
├─ app.ts               # Express API 与错误边界
└─ index.ts             # 服务端入口
```

### AI NPC 隔离

- 每名 NPC 都有独立 Profile、目标、关系、知识边界和真话策略。
- 浏览器只保存该 NPC 自己的 session 对话历史，切换人物不会混入其他人的上下文。
- 服务端只为当前 NPC 组装 Prompt。
- 只有 `discoveredEvidenceIds` 对应的已发现证据会进入模型上下文。
- NPC 私有资料、完整案件真相和结案判定不进入前端 bundle。
- Agent 与 Prompt 层不依赖具体厂商；Provider 由服务端环境变量选择。

### API

`POST /api/interrogate`

```json
{
  "npcId": "jack",
  "message": "你 23:09 在哪里？",
  "conversationHistory": [],
  "discoveredEvidenceIds": ["alarm-log"]
}
```

结构化响应：

```json
{
  "reply": "角色实际说的话",
  "emotion": "evasive",
  "revealedFactIds": [],
  "contradictionIds": []
}
```

`POST /api/case/resolve` 仅在最终指认后返回结案结果，使完整案件真相留在服务端。

## 安全说明

- `LLM_API_KEY` 只由 Express 服务端读取。
- 前端不会读取或调用任何 LLM Provider，也不会把 Key 打进 Vite bundle。
- `.env`、`.env.local` 等真实环境文件已被 `.gitignore` 忽略。
- 只能提交不含密钥的 `.env.example`。
- 请求体有严格类型、长度和大小限制。
- API 失败、超时或未配置 Key 时，页面不会崩溃，原有预设问题仍可使用。

## V0.2 已知限制

- 会话历史只保存在当前浏览器内存中，刷新后清空。
- 暂无数据库、登录、多设备同步或长期 NPC Memory。
- 自由对话暂不自动解锁 V0.1 证据；证据仍通过既有调查切入点获得。
- `revealedFactIds` 和 `contradictionIds` 已返回并保存，但尚未进入评分系统。
- 回答质量、延迟和成本取决于所配置模型与 Provider API 状态。
- Prompt 能显著约束角色，但 LLM 仍可能偶发产生不一致回答。

## Roadmap

- 持久化 NPC Memory
- 自由对话触发证据与矛盾标记
- Evidence-aware Dialogue 的更细粒度证据出示动作
- Agent 行为评测与一致性测试集
- Dynamic Case Generation（不属于 V0.2）

# AI Interrogation Game

[![CI](https://github.com/HunmiJ/AI-Interrogation-Game/actions/workflows/ci.yml/badge.svg)](https://github.com/HunmiJ/AI-Interrogation-Game/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Render-46E3B7?logo=render&logoColor=white)](https://ai-interrogation-game-3dto.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一款结合 AI 对话与确定性证据推理的调查游戏。玩家审讯嫌疑人、比对口供和证据、发现矛盾，并完成最终指认。

## 在线试玩

[点击试玩 AI Interrogation Game](https://ai-interrogation-game-3dto.onrender.com)

> Render 免费实例空闲后会休眠，首次打开可能需要约一分钟唤醒。

> **V0.5.0** · 经典案件 + 经验证的 AI 动态案件 · React / TypeScript / Express

## 项目简介

游戏包含一个可稳定游玩的经典案件，以及可生成盗窃、数据泄露、欺诈和物品调包等主题的 AI 动态案件。AI 负责角色对话与案件草稿，但事实、证据、矛盾、凶手和分数均由确定性游戏引擎控制。

这不是在界面中额外放置一个聊天机器人：AI 是互动与内容生成的一部分，而游戏的可解性和结案逻辑始终由服务端规则保证。

## 核心功能

- **经典案件**：包含 3 名嫌疑人、预设问答、证据链、矛盾判定和结案评分。
- **AI 动态案件**：生成后会经过结构、质量、依赖关系和可解性校验，只有通过校验的案件才能开始。
- **自由审讯**：可用自然语言追问每位 NPC；每位角色拥有独立的对话历史与知识边界。
- **事实与证据解锁**：AI 提出的候选事实必须通过服务端验证，才能解锁关联证据。
- **矛盾检测**：必须有已确认的口供与玩家明确出示的证据，才会形成矛盾。
- **调查笔记本**：集中展示已确认事实、物证/记录与口供矛盾。
- **服务端结案**：最终指认、得分和完整真相均在服务端计算，浏览器不能伪造结果。
- **稳定性与安全性**：包含取消请求、超时、限流、错误边界、输入校验和安全响应头。

## AI 与游戏规则的边界

```text
玩家提问
  -> AI NPC 生成符合角色设定的回答与候选事实
  -> 确定性规则引擎验证候选内容
       -> 解锁证据
       -> 判定矛盾
       -> 更新调查进度
       -> 计算结案分数
```

AI 只能提出候选信息，不能直接新增事实、解锁证据、指定凶手或计算分数。详细设计见 [架构文档](docs/ARCHITECTURE.md)。

## 动态案件生成流程

```text
选择案件类型与难度
  -> AI 生成结构化草稿
  -> 安全标准化
  -> 定向修复（最多 3 次）
  -> 结构与叙事质量校验
  -> 依赖环与可解性校验
  -> 服务端私密会话
  -> 向浏览器发送最小化公开案件数据
```

无效案件不会进入游戏；生成失败时，玩家可以重试、调整选项，或转入经典案件。

## 技术栈

- React、TypeScript、Vite
- Tailwind CSS、Lucide React
- Node.js、Express、Zod
- DeepSeek（默认）与 OpenAI Provider Adapter
- Node Test Runner、Supertest
- Render（公开试玩部署）

## 本地运行

环境要求：Node.js 18+、npm。

```bash
npm install
copy .env.example .env
npm run dev
```

经典案件不需要 API Key。若要使用自由审讯与 AI 动态案件，请在 `.env` 中配置服务端密钥：

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=your_provider_key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_TIMEOUT_MS=60000
DEBUG_AI_INVESTIGATION=false
DEBUG_DYNAMIC_CASE_INVESTIGATION=false
```

以 [`.env.example`](.env.example) 为准。请勿把密钥命名为 `VITE_` 前缀的变量，因为该类变量会被打包到浏览器代码中。

如需改用 OpenAI，只需调整服务端环境变量：

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_BASE_URL=https://api.openai.com/v1
```

## 常用命令

```bash
npm run dev                         # 启动前端与 Express 开发服务
npm run typecheck                   # 严格 TypeScript 类型检查
npm test                            # 自动化测试
npm run build                       # 类型检查并构建生产版本
npm run preview                     # 预览生产构建
npm run smoke:v03                   # 使用真实 Provider 的 V0.3 冒烟测试
npm run smoke:v04:generation        # 使用真实 Provider 的动态生成冒烟测试
npm run smoke:v04:data-leak-final   # 使用真实 Provider 的数据泄露结案冒烟测试
```

冒烟测试会消耗 Provider 额度，因此不属于常规自动化测试。

## 项目结构

```text
src/
  components/       页面与交互组件
  data/             浏览器可安全使用的经典案件展示数据
  hooks/            游戏状态与独立 NPC 对话会话
  services/         带边界的浏览器 API 客户端
  types/            公开客户端契约
  utils/            确定性浏览器会话辅助工具

server/
  agents/           私密的经典 NPC 档案
  data/             经典案件真相、证据规则与评分
  dynamicCases/     动态案件生成、验证、会话与结案
  middleware/       安全响应头与成本控制限流
  prompts/          仅服务端可见的审讯提示词
  providers/        DeepSeek/OpenAI 适配器与安全错误处理
  services/         审讯编排与验证
  scripts/          可选的真实 Provider 冒烟测试

docs/
  ARCHITECTURE.md    架构与安全边界说明
```

## 安全与成本控制

- Provider 密钥只由 Express 服务端读取；`.env` 已被 Git 忽略。
- 私密人物档案、完整提示词、凶手 ID 和未解锁的解法节点不会发送到浏览器。
- 动态案件公开数据使用白名单输出，并有回归测试避免泄露。
- 请求体、输入长度和数组长度均受严格校验。
- 自由审讯按客户端限流；成本更高的案件生成使用更严格的时间窗口。
- 每次生成最多尝试 3 次；同一时间只允许一个生成任务。
- 浏览器请求有超时处理；重置调查会取消未完成的审讯请求。
- Provider 日志会脱敏；详细调查日志默认关闭。
- 使用 CSP、禁止嵌入、限制浏览器权限等安全响应头。

## 测试

自动化测试覆盖经典案件、V0.3 调查流程、V0.4 动态案件、语义事实匹配、证据/矛盾依赖图、会话隔离与重置、生成重试、私密数据排除、Provider 路由、凭据脱敏、请求限流和 V0.5 稳定性控制。

发布前检查：

```bash
npm run typecheck
npm run build
npm test
git diff --check
git status --ignored --short
```

## 版本历史

- **V0.1**：离线可游玩的原型
- **V0.1.1**：UI/UX 打磨
- **V0.2**：实时 AI NPC 审讯
- **V0.3**：AI 驱动的调查系统
- **V0.4**：经过验证的动态案件系统（`v0.4.0`）
- **V0.5.0**：项目文档、稳定性、安全与成本控制、响应式打磨，以及公开试玩部署（`v0.5.0`）

## 已知限制

- 调查进度保存在内存中，刷新页面或服务重启后会丢失。
- 暂无账号、数据库、多设备同步或长期 NPC 记忆。
- LLM 的文字表现、延迟、可用性和成本取决于配置的 Provider。
- 语义匹配采用保守策略，较间接的陈述可能需要进一步追问。
- 如果证据图不够稳定可解，动态生成会拒绝看似合理的故事。
- Render 免费实例会在空闲后休眠。

## 后续方向

可继续加入数据持久化、无障碍与多语言支持、更多手工案件，以及动态案件质量评估工具。

## 许可证

本项目采用 [MIT License](LICENSE)，欢迎学习、复用和二次创作，并请保留原始版权与许可证声明。

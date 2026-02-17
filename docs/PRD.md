# Kata Cloud: Product Requirements Document

**Codename:** kata-cloud
**Version:** 0.2 (Revised)
**Date:** 2026-02-12
**Author:** Generated from competitive analysis, codebase exploration, and SDK research

---

## 1. Product Vision

Kata Cloud is an agent-first software development platform where developers orchestrate AI agent teams rather than write code directly. It delivers opinionated, spec-driven development workflows, git worktree-based parallelism, and agent team coordination.

Kata Cloud runs locally via Claude Max / Codex subscriptions, API keys or in the cloud via SaaS subscription. It eliminates the friction between "tell the AI what to build" and "ship a pull request" by treating specifications as executable prompts and agents as the primary workforce.

### Core Thesis

The agentic coding market has split into two camps. Vibe coding platforms (Lovable, Bolt.new, v0) prioritize speed to prototype. Spec-driven platforms prioritize maintainability, auditability, and team coordination. Lovable hit $100M ARR in eight months by owning the vibe-coding side. Kata Cloud owns the spec-driven side for professional engineering teams.

First-generation agentic IDEs started as code editors and added agent capabilities incrementally. They optimize for the developer-writes-code workflow and treat agents as assistants. Kata Cloud inverts this: the developer is an orchestrator who defines specifications, reviews agent output, and approves pull requests. The agents do the implementation.

Every Kata Cloud workflow produces an atomic pull request as its deliverable. The PR is the unit of work. Most competitors treat PR creation as an afterthought or skip it entirely. Kata treats it as the core output.

---

## 2. Market Analysis

### 2.1 Market Size and Dynamics

Enterprise spend on AI coding tools reached $4 billion in 2025, up from $550 million in 2024. The market is projected to reach $47.3 billion by 2034. Over $10 billion in venture funding deployed into agentic coding companies in the 18 months ending February 2026. MIT named generative coding a Top 10 Breakthrough Technology of 2026.

Anthropic commands 54% of coding market share versus OpenAI's 21%. Claude is the dominant model for code generation, which gives Kata Cloud a structural advantage as a Claude-native platform.

### 2.2 The Spec-Driven vs. Vibe-Coding Bifurcation

The market has bifurcated along a fundamental axis.

Vibe coding platforms generate complete applications from natural language prompts. They target non-developers and rapid prototyping. Lovable ($100M ARR in 8 months, $6.6B valuation), Bolt.new ($40M ARR in 6 months), and v0 (part of Vercel's $9.3B ecosystem) lead this segment. These tools produce fast output that frequently requires extensive rework for production use.

Spec-driven platforms impose structure on AI-generated code before it gets written. They target professional engineering teams building software that needs to be maintained, reviewed, and extended over time. Tessl ($125M raised, founded by Snyk creator), Kiro (AWS, 250K+ users), and GitHub Spec Kit (open-source, agent-agnostic) lead this segment.

Kata Cloud competes in the spec-driven segment. The positioning argument: as AI generates more code faster, the constraint shifts from writing speed to code quality, maintainability, and team coordination. Specs-before-code addresses this constraint directly.

### 2.3 Competitive Landscape (February 2026)

The market has stratified into five structural tiers. Every tier contains competitors relevant to Kata Cloud's positioning.

#### Tier 1: Horizontal IDE Platforms

These tools started as code editors and added agentic capabilities. They compete on developer experience and breadth of integration.

**GitHub Copilot** is the largest player by installed base: 20M+ lifetime users, 90% Fortune 100 adoption. Evolved from autocomplete into a multi-modal agentic platform. The Copilot coding agent (GA 2025) autonomously takes GitHub issues, creates branches, implements changes, and opens draft PRs via GitHub Actions. Agent Mode in VS Code handles multi-step tasks with self-healing. Multi-model support includes Claude Opus 4.5, GPT-5.1, Gemini 3 Pro, and o3. Five pricing tiers: Free (2K completions/mo), Pro ($10/mo), Pro+ ($39/mo), Business ($19/user/mo), Enterprise ($39/user/mo). GitHub Copilot PR Reviews covers 90% of PRs at Microsoft (600K+/month).

**Cursor** (Anysphere): VS Code fork with cloud agents on AWS VMs. Broadest integration surface (Slack, Linear, GitHub Actions). Multi-model strategy. $20-200/mo. Raised $3.3B+ at $29.3B valuation (November 2025). Most mature cloud agent UX among IDE-based tools.

**Windsurf/Codeium**: Acquired by Cognition for its proprietary SWE-1.5 coding model. Similar trajectory to Cursor before acquisition.

**Kiro** (AWS): Spec-driven IDE that converts natural language into formal specifications, then executable task plans, then code. 250K+ users during preview. GA at $20/mo Pro tier. Direct competitor to Kata's spec-driven approach, backed by AWS distribution.

**Trae** (ByteDance): Completely free AI-native IDE with unlimited GPT-4o and Claude Sonnet access. Significant privacy concerns about telemetry to ByteDance servers. Relevant as a pricing floor.

#### Tier 2: Autonomous Agents

These tools operate as fully autonomous coding agents. They receive a task and produce a result without continuous human guidance.

**Cognition/Devin**: The most prominent autonomous agent. Devin 2.0 operates as a fully autonomous AI software engineer in a cloud sandbox. $696M raised at $10.2B valuation (September 2025, Founders Fund). Grew from $1M to $73M ARR in nine months. Acquired Windsurf. Pricing dropped from $500/mo to $20/mo minimum (pay-as-you-go at $2.25/ACU), Team at $500/mo. Powers Goldman Sachs, Citi, Dell, Cisco, Palantir. GA.

**Factory AI**: Enterprise-grade autonomous "Droids" (specialized sub-agents for code implementation, knowledge research, reliability incident triage, product backlog management). Droids are LLM-agnostic and interface-agnostic (IDE, terminal, Slack, Linear, CLI). #1 on Terminal-Bench (58.75%, beating Claude Code and Codex CLI). $50M Series B (September 2025, NEA + Sequoia). Customers: MongoDB, Ernst & Young, Zapier, Bayer, NVIDIA. Reports 31x faster feature delivery. Factory's Droid model is the closest architectural analog to Kata's agent team approach. Key difference: Factory's Droids are pre-specialized by function (Review Droid, Documentation Droid); Kata's teams are dynamically composed per workflow phase.

**Replit Agent**: Fully browser-based autonomous development. Agent 3 (September 2025) with Design Mode, Fast Build, extended thinking. $25/mo Core, $100/mo Pro. $240M revenue in 2025, expects $1B in 2026. 150K+ paying customers. $400M raise at $9B valuation reportedly nearing close (January 2026).

**Emergent** (YC): Coordinated teams of specialized agents for full-stack apps. $50M ARR in seven months, 5M+ users, 6M+ apps built. $100M raised (Khosla, SoftBank, Google).

#### Tier 3: Spec-Driven and Multi-Agent Orchestration

These tools impose structure on AI-generated code through specifications, plans, or agent coordination frameworks.

**Tessl**: Founded by Snyk creator Guy Podjarny. $125M raised ($25M seed + $100M Series A, Index Ventures + Accel). Spec Registry with 10,000+ pre-built specifications. Tessl Framework guides agents to create plans, specs, and tests before writing code. Vision: specifications as primary artifact, code as byproduct. Framework in closed beta. The most well-funded pure spec-driven startup and Kata's closest strategic competitor.

**Augment Code (Intent)**: Spec-driven desktop app with Coordinator + specialist agents (Investigate, Implement, Verify, Critique, Debug, Code Review). Isolated git worktrees per prompt. Multi-model. $20-50/mo. $252M raised at $977M valuation. Closest competitor to Kata Cloud's specific workflow design.

**GitHub Spec Kit**: Open-source, agent-agnostic. Templates, CLI tool (Specify), four-phase gated workflow (Specify, Plan, Tasks, Implement). Works with Copilot, Claude Code, Gemini CLI, Cursor, and 10+ agents via Markdown. Relevant as an open standard Kata should interoperate with.

**Multi-agent orchestration frameworks** (CrewAI, Microsoft AutoGen/AG2, LangGraph, MetaGPT, OpenAI Agents SDK, Google ADK, Roo Code, Shakudo AgentFlow) provide the coordination primitives that Kata's Agent Team Orchestrator competes with. Kata differentiates by being opinionated and workflow-specific rather than general-purpose. LangGraph offers finer-grained control; CrewAI offers YAML-driven simplicity; MetaGPT simulates entire software companies. Kata's bet is that coding-specific workflow enforcement beats general-purpose agent frameworks for the software development use case.

#### Tier 4: Terminal-Native Agents

Terminal-native coding agents proliferated from roughly three options in early 2025 to 15+ by early 2026. The terminal has become a primary surface for agentic coding.

**Claude Code** (Anthropic): Strongest terminal agent for deep reasoning, debugging, and architectural changes. Priced via Claude API tokens. The foundation model Kata Cloud builds on.

**Codex CLI** (OpenAI): Rebuilt in Rust. macOS desktop app (February 2026). Local-first execution with configurable permissions. GPT-5.2-Codex model. Included with ChatGPT Plus/Pro.

**Gemini CLI** (Google): Most generous free tier: 60 req/min, 1K/day. 1M token context window. Built-in Google Search grounding. Apache 2.0.

**OpenCode**: Fastest-growing open-source terminal agent. 95K+ GitHub stars, 2.5M monthly developers. 75+ LLM providers, multi-session parallel development, LSP integration.

**Amp** (Sourcegraph): CLI-first with "Deep mode" using sub-agents (Oracle, Librarian, Painter). Free tier ad-supported up to $10/day. Sourcegraph killed Cody VS Code extension to focus on Amp CLI.

**Kilo Code** (GitLab co-founder Sid Sijbrandij): Open-source, supports VS Code, JetBrains, CLI, Slack. 500+ models, Memory Bank, Orchestrator mode. 500K+ downloads, $8M seed.

**Others**: GitHub Copilot CLI, Goose (Block/Square), Crush (Charmbracelet), gptme.

**Warp (Oz)**: Terminal-native, event-driven cloud agents. Triggers from crashes, Slack, cron, CI. $20/mo + credits. Strongest observability (session transcripts, team dashboards).

Kata Cloud's CLI should be a first-class surface on par with these tools, leveraging the workflow engine that none of them provide.

#### Tier 5: Infrastructure and Model Plays

**Poolside AI**: Purpose-built coding foundation models deployed within customer environments. $500M+ raised at $3B valuation. $2B round in progress at $12B valuation (NVIDIA investing up to $1B). Founded by former GitHub CTO Jason Warner. Not a direct competitor but a potential platform shift if proprietary coding models outperform general-purpose ones.

**Magic.dev**: Pre-product with $466M+ raised. Building Long-Term Memory Network architecture for 100M token context windows. ~20-person team. Google Cloud partnership (8K H100 GPUs). Highest-funded company with no shipping product.

#### Enterprise Competitors

Enterprise buyers prioritize deployment flexibility, compliance, and governance over raw AI capability.

**Tabnine Enterprise** ($39/user/mo): Only major AI coding assistant offering fully air-gapped, self-hosted deployment. Supports SaaS, VPC, on-prem Kubernetes, air-gapped clusters. GDPR, SOC 2, ISO 27001. IP indemnification. 2025 Gartner Magic Quadrant Visionary.

**Amazon Q Developer** ($19/user/mo Pro, perpetual free tier): Most competitive pricing. Autonomous agents for code transformation at scale (AWS upgraded 1,000 apps Java 8 to 17 in 2 days, saved $260M internally). SOC, ISO, HIPAA, PCI eligible.

**Sourcegraph Cody Enterprise** ($59/user/mo): Deepest cross-repository code intelligence. Free/Pro plans discontinued July 2025 to focus exclusively on enterprise. 4 of 6 top US banks, 15+ US government agencies.

**JetBrains AI** (Junie agent): Native JetBrains static analysis integration. Credit-based pricing: AI Free (unlimited local completions), AI Ultimate ($30/mo). Bootstrapped (no VC).

**Qodo** (formerly CodiumAI): Review-first platform with persistent Codebase Intelligence Engine. VPC, on-prem, zero-retention deployment. SOC 2, GDPR. 2025 Gartner Magic Quadrant Visionary.

#### Open-Source Landscape

Open-source projects compete effectively with commercial tools on benchmarks and pose a continuous price-floor threat.

**OpenHands** (All Hands AI): 65K+ GitHub stars. >50% SWE-bench, claims 87% same-day bug ticket resolution. $18.8M seed (Menlo Ventures). MIT license.

**Aider**: 38.9K+ stars. Pioneered CLI pair programming. Architect+editor dual-model mode. 15B tokens/week across 4.1M installations. Apache 2.0.

**SWE-agent** (Princeton): 18.4K+ stars. 72% SWE-bench Verified with Claude Sonnet 4.5 High. MIT license.

**Continue.dev**: 20K+ stars. VS Code/JetBrains extension with PR review agents. Apache 2.0.

**Others**: Cline (4M+ VS Code installs), Roo Code (multi-mode orchestrator), Goose (Block), Plandex (2M token context).

#### AI Code Review and Testing

Adjacent market tools that review, test, and validate AI-generated code.

**CodeRabbit**: $60M Series B. Most-downloaded app in GitHub marketplace. 2M+ repos, 13M+ PRs reviewed. Free for open-source, $12/user/mo.

**Greptile**: Repository-wide semantic graph. 82% bug catch rate (vs. 44-58% for competitors). $25M Series A (Benchmark). 1K+ teams.

**Graphite**: $52M raised. Diamond AI reviewer + stacked PRs. 65K developers (Shopify, Snowflake, Perplexity AI).

**TestSprite**: Outperformed GPT/Claude/DeepSeek in benchmarks (42% to 93% pass rate). Autonomous testing via MCP.

#### Additional Notable Players

**1Code**: Open-source Cursor-like UI wrapping Claude Code SDK. Worktree isolation, background execution. Uses Claude Max subscription.

**Team9**: Open-source Slack-like workspace where AI agents are channel members. OpenClaw runtime. Early stage (February 2026 launch).

**Snowflake Cortex Code** (launched February 3, 2026): Snowflake-native coding agent for data engineering.

**CodeFlicker** (Kuaishou, launched February 12, 2026): Parallelized multi-agent architecture with Figma-to-Code.

### 2.4 Funding Context

| Company            | Total Raised | Valuation          | Notable Round                   |
| ------------------ | ------------ | ------------------ | ------------------------------- |
| Anysphere (Cursor) | $3.3B+       | $29.3B             | $2.3B Series D, Nov 2025        |
| Cognition (Devin)  | $696M        | $10.2B             | $400M, Sep 2025                 |
| Poolside AI        | $626M+       | $3B ($12B pending) | $500M Series B; $2B in progress |
| Magic.dev          | $466M+       | ~$1.5B             | $320M Series C, Aug 2024        |
| Replit             | $250M+       | $3B ($9B pending)  | $400M nearing close             |
| Augment Code       | $252M        | $977M              | $227M Series B, Apr 2024        |
| Lovable            | $215M+       | $6.6B              | $200M through 2025              |
| Tessl              | $125M        | N/A                | $100M Series A, late 2025       |
| Emergent           | $100M        | $300M              | Multi-investor round            |
| CodeRabbit         | $60M         | N/A                | Series B, early 2025            |
| Factory AI         | $50M         | N/A                | Series B, Sep 2025              |

### 2.5 Market Gaps Kata Cloud Addresses

| Gap                           | Status Quo                                                                                                       | Kata Cloud Approach                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec-driven orchestration     | Tessl and Kiro compete here; Augment Intent is closest to Kata                                                   | Specs are executable prompts with traceability IDs, requirement mapping, and verification loops. Enforced methodology goes further than Augment's flexible approach |
| Structured agent teams        | Most products run single agents; Cursor runs multiples without coordination; Factory uses pre-specialized Droids | Claude Agent SDK Agent Teams with lead/teammate roles, task dependency chains, wave-based execution. Dynamic team composition per phase                             |
| Opinionated workflows         | Every product is a general-purpose tool; none enforce development methodology                                    | Kata enforces: spec, milestone, phase, plan, execute, verify, release                                                                                               |
| PR-centric output             | GitHub Copilot's coding agent creates PRs from issues; most others treat PRs as afterthought                     | Every workflow produces an atomic PR. The PR is the deliverable                                                                                                     |
| Integrated project management | Slack and Linear integrations exist but function as notification channels                                        | Linear issues drive agent work; GitHub PRs close issues; milestones map to releases                                                                                 |
| Claude Max local execution    | 1Code does this; others require separate API subscriptions                                                       | First-class Claude Max support with automatic model routing per task type                                                                                           |
| Self-hosted cloud option      | Tabnine offers air-gapped; Qodo offers VPC/on-prem; most others are cloud-only                                   | Container-based deployment using Claude Agent SDK Docker/gVisor patterns. VPC and on-prem options for enterprise                                                    |

### 2.6 Positioning

Kata Cloud occupies the opinionated orchestration layer: more structured than Augment Intent, more agent-native than Cursor, more workflow-driven than Codex, and built on the Claude Agent SDK rather than being model-agnostic.

The primary competitive threats, ranked by severity:

1. **Tessl**: Direct spec-driven competitor with $125M and Snyk-founder credibility. Tessl's Spec Registry (10K+ pre-built specs) and Framework directly compete with Kata's spec-driven workflow. Differentiator: Kata enforces an end-to-end methodology (spec through merged PR); Tessl provides spec tooling that works with any agent.

2. **Augment Intent**: Closest workflow competitor with Coordinator + specialist agents, worktree isolation. Differentiator: Kata uses Claude Agent SDK Agent Teams (vs. Augment's proprietary coordination), enforces methodology (vs. Augment's flexibility), supports dual local/cloud execution (vs. Augment desktop-only).

3. **GitHub Copilot**: 20M+ users, 90% Fortune 100. The coding agent already creates PRs from issues. Distribution advantage is massive. Differentiator: Copilot is a general-purpose assistant; Kata enforces a structured workflow that produces higher-quality output on complex multi-phase projects.

4. **Factory AI**: Enterprise agent performance leader (#1 Terminal-Bench). Droid model is architecturally similar to Kata's agent teams. Differentiator: Factory's Droids are pre-specialized; Kata's teams are dynamically composed. Factory is enterprise-focused; Kata serves individual developers through Claude Max local mode.

5. **Open-source tools** (OpenHands, OpenCode, Aider): Strong community momentum, free. Differentiator: Kata delivers workflow opinionation, hosted orchestration state, team coordination, and integrated project management that open-source tools lack. Raw agentic coding is not defensible; workflow value is.

### 2.7 Pricing Justification

The $29-79/mo cloud pricing sits in a market where Devin dropped to $20/mo, GitHub Copilot Free exists, Gemini CLI is completely free, and Amazon Q Developer has a perpetual free tier.

The pricing defense rests on three arguments:

1. **Kata charges for workflow orchestration, not model access.** Free/cheap tools give you an agent. Kata gives you a structured development process that produces reviewable, traceable, mergeable output. The value unit is "spec to merged PR," not "tokens consumed."

2. **Local mode is free.** Developers with Claude Max ($100-200/mo) can use Kata Cloud desktop for $0. This neutralizes pricing pressure from free tools and creates a funnel to paid cloud features.

3. **Agent-hours billing aligns cost with value.** Users pay for wall-clock execution time, not tokens. A phase that produces a merged PR in 30 minutes costs the same regardless of how many tokens the agents consumed.

The risk: if GitHub Copilot or Codex adds spec-driven workflow features, the pricing premium collapses. Kata must build enough workflow value and switching cost before that happens.

### 2.8 MCP as Integration Strategy

Model Context Protocol (MCP) has become the universal connector for agentic tools. Apple adopted MCP in Xcode 26.3 (February 2026), marking mainstream IDE ecosystem entrance. GitHub Spec Kit, Cline, TestSprite, and dozens of other tools use MCP for tool integration.

Kata Cloud should implement MCP compatibility at three levels:

1. **MCP server**: Expose Kata's workflow engine as an MCP server so other tools (Claude Code, Cursor, Copilot) can invoke Kata workflows.
2. **MCP client**: Consume external MCP servers for custom tools, following the pattern already established in Kata Agents.
3. **MCP tool marketplace**: Allow third-party MCP servers to plug into Kata workflows, extending the platform without building every integration in-house.

This turns Kata from a closed platform into an orchestration layer that works with the broader ecosystem.

---

## 3. Existing Assets

### 3.1 Kata Orchestrator

**Repository:** `/Users/gannonhall/dev/kata/kata-orchestrator/`
**What it is:** A Claude Code plugin with 32 skills implementing the full spec-driven development lifecycle.

**Key capabilities to carry forward:**

Spec-driven workflow: Project, Milestone, Phase, Plan, Execute, Verify, Release. Requirements traceability with IDs (AUTH-01, CONTENT-02) traced from requirements to phases to commits. Wave-based parallel execution with plans grouped by dependency. Orchestrator/agent split where orchestrators stay lean (~15% context) and agents get fresh 200k windows. Plan-as-prompt pattern where PLAN.md files are both documentation and executable instructions. Model profiles (quality/balanced/budget) routing different task types to Opus/Sonnet/Haiku. GitHub integration mapping milestones, issues, PRs, and releases to Kata artifacts. Template customization with per-project overrides. PR review suite with 6 parallel review agents (code, tests, comments, failures, types, simplicity).

**Architecture insight:** The orchestrator's skill-based design demonstrates that spec-driven workflows decompose into ~32 discrete operations. Kata Cloud preserves this granularity while providing a unified UI.

### 3.2 Kata Agents

**Repository:** `/Users/gannonhall/dev/kata/kata-agents/`
**What it is:** An Electron desktop app combining Claude Code's agent capabilities with Slack-style communication.

**Key capabilities to carry forward:**

Multi-session management with inbox/archive views, status workflow (Todo, In Progress, Needs Review, Done), flagging. CraftAgent engine (3,080-line Claude Agent SDK wrapper) with session isolation, permission management, tool coordination. Permission modes: Explore (read-only), Ask (approval required), Execute (auto-approve), Daemon (allowlist-only). Channel system with Slack, WhatsApp, email adapters via plugin architecture. Plugin system (KataPlugin interface with channels, tools, services registries). Source integrations via MCP servers, REST APIs, local filesystems with OAuth support. Credential management with AES-256-GCM encrypted storage and auto-refresh. Git integration with real-time branch/PR context, worktree support, system prompt injection. Dynamic status system with customizable workflow states. Skills system with workspace-scoped SKILL.md instructions and glob-based auto-activation. Event-driven architecture with typed AgentEvent stream. Deep linking via kataagents:// URL protocol.

**Architecture insight:** The subprocess isolation pattern (one Bun process per session) and daemon architecture provide the foundation for scaling to multiple concurrent agent teams.

---

## 4. Technical Foundation

### 4.1 Claude Agent SDK

Kata Cloud builds on the Claude Agent SDK (TypeScript), which provides:

**Core Primitives:** `query()` for streaming agent execution with typed message events. Built-in tools: Read, Write, Edit, Bash, Glob, Grep. Custom tools via MCP servers (in-process or external). Permission modes: default, acceptEdits, bypassPermissions. Session management with resume capability. Hooks system: PreToolUse, PostToolUse, Stop, SubagentStart/Stop, SessionStart/End.

**Agent Teams (February 2026, Research Preview):** Team Lead + Teammates architecture. Each teammate gets independent context window. SendMessage for direct messages and broadcasts. TaskUpdate for task lifecycle and dependency management. File-based coordination (task files on disk). Teammates share project context (CLAUDE.md, MCP, skills) but not conversation history.

**Deployment:** Container-first: Docker with security hardening, gVisor, Firecracker. Network isolation via Unix socket + validating proxy. Domain allowlists, credential injection, traffic logging.

**How this compares to multi-agent frameworks:** LangGraph provides graph-based state machines with finer-grained control over branching. CrewAI offers YAML-driven role definitions. MetaGPT simulates an entire software company with SOPs. OpenAI Agents SDK provides lightweight Python primitives. Google ADK enables hierarchical agent compositions. Kata chooses Claude Agent SDK Agent Teams because: (a) the Teams capability provides coordinated multi-agent messaging with shared project context, (b) built-in coding tools match exactly what coding agents need, (c) the hooks system enables safety controls without LLM overhead, and (d) Anthropic's deployment guidance aligns with cloud mode requirements. The trade-off: general-purpose orchestration frameworks support any model; Kata is Claude-locked.

### 4.2 Proposed Architecture

```
+-----------------------------------------------------------------+
|                        Kata Cloud                                |
|                                                                  |
|  +--------------+  +--------------+  +-----------------------+  |
|  |  Desktop App |  |   Web App    |  |   CLI                 |  |
|  |  (Electron)  |  |  (React)     |  |   (kata-cloud)        |  |
|  +------+-------+  +------+-------+  +-----------+-----------+  |
|         |                  |                       |              |
|         +------------------+-----------------------+              |
|                            |                                      |
|                   +--------+--------+                             |
|                   |  Kata Core API  |                             |
|                   |  (TypeScript)   |                             |
|                   +--------+--------+                             |
|                            |                                      |
|         +------------------+----------------------+               |
|         |                  |                       |              |
|  +------+------+  +-------+-------+  +-----------+----------+   |
|  |  Workflow   |  |  Agent Team   |  |  Integration         |   |
|  |  Engine     |  |  Orchestrator |  |  Layer               |   |
|  |             |  |               |  |                      |   |
|  | - Specs     |  | - SDK Teams   |  | - GitHub API         |   |
|  | - Milestones|  | - Worktrees   |  | - Linear API         |   |
|  | - Phases    |  | - Task mgmt   |  | - MCP servers        |   |
|  | - Plans     |  | - Messaging   |  | - Channel adapters   |   |
|  | - Verify    |  | - Context     |  | - OAuth              |   |
|  +-------------+  +---------------+  +----------------------+   |
|                            |                                      |
|              +-------------+-------------+                        |
|              |                           |                        |
|     +--------+--------+   +-------------+---------+              |
|     |  Claude Agent   |   |  MCP Layer            |              |
|     |  SDK            |   |  (server + client)    |              |
|     +-----------------+   +-----------------------+              |
|                                                                  |
|  Execution Modes:                                                |
|  +-----------------+  +--------------------+                     |
|  |  Local Mode     |  |  Cloud Mode        |                    |
|  |  (Claude Max)   |  |  (SaaS/Self-host)  |                    |
|  +-----------------+  +--------------------+                     |
+-----------------------------------------------------------------+
```

### 4.3 Component Breakdown

**Desktop App (from Kata Agents foundation):** Electron + React + Tailwind. Multi-session management with inbox/archive. Integrated git client with one-click PR creation. Agent team visualization (live status of lead + teammates). Permission mode cycling. Session status workflow.

**Web App:** React SPA sharing components with desktop app. Cloud-only execution (no local agent processes). Team collaboration: shared workspaces, session visibility. Mobile-responsive for on-the-go agent management.

**CLI (first-class surface):** `kata-cloud` command for headless operation. Compatible with CI/CD pipelines. All workflow operations available programmatically. Competes directly with Claude Code, Codex CLI, and Gemini CLI as a terminal-native agent with structured workflow capabilities that those tools lack.

**Kata Core API:** TypeScript library shared across all surfaces. Workflow engine: spec parsing, milestone management, phase lifecycle. Agent team orchestration via Claude Agent SDK. Integration layer: GitHub, Linear, MCP.

**MCP Layer:** Kata as MCP server (exposes workflow engine to external tools). Kata as MCP client (consumes external tool servers). Tool discovery and registration. Tool annotations (readOnlyHint, destructiveHint).

**Workflow Engine (from Kata Orchestrator patterns):** Spec-driven lifecycle: Project, Milestone, Phase, Plan, Execute, Verify, Release. Requirements traceability with IDs. Wave-based parallel execution. Plan-as-prompt pattern. Template customization. Model routing profiles.

**Agent Team Orchestrator:** Wraps Claude Agent SDK Agent Teams. Manages worktree creation/cleanup per agent. Routes tasks to teammates based on dependency graph. Collects results and synthesizes summaries. Handles agent failure/retry.

**Integration Layer:** GitHub (repos, branches, PRs, issues, releases, actions). Linear (issues, projects, cycles, labels). MCP (custom tool servers). Channel adapters (Slack, email from Kata Agents).

---

## 5. User Personas

### 5.1 Solo Developer (Local Mode)

**Profile:** Individual developer using Claude Max subscription. Wants to move faster on side projects or professional work without paying for a separate SaaS.

**Workflow:** Opens Kata Cloud desktop app. Points it at a repo. Creates a project spec through guided conversation. Kicks off a milestone. Reviews PRs as agents complete phases. Merges and ships.

**Key needs:** Zero additional cost beyond Claude Max. Fast setup (< 5 minutes to first agent run). Works offline. Simple git workflow (agents create branches, user merges).

**Competitive alternative:** Claude Code or Codex CLI (free with subscription, but no workflow structure). 1Code (open-source, worktree isolation, but no spec-driven workflow).

### 5.2 Tech Lead (Cloud Mode)

**Profile:** Leads a team of 3-8 engineers. Uses Kata Cloud to parallelize feature development across multiple agent teams while the human team handles architecture decisions, code review, and customer-facing work.

**Workflow:** Creates milestones from Linear epics. Dispatches phases to agent teams. Reviews PRs with the built-in review suite. Tracks progress across multiple concurrent agent teams. Monitors cost and throughput via dashboard.

**Key needs:** Multiple concurrent agent teams. Cost visibility and controls. Team workspace sharing. GitHub PR integration with CI checks. Linear issue lifecycle management.

**Competitive alternative:** Augment Intent (spec-driven, worktree isolation, but desktop-only). Factory AI (enterprise agents, but pre-specialized Droids rather than dynamic teams). Cursor Cloud (multiple agents, but no workflow enforcement).

### 5.3 Platform Engineer (Self-Hosted Cloud)

**Profile:** Responsible for developer tooling at a mid-size company. Needs to run agent infrastructure on company cloud with data residency requirements.

**Workflow:** Deploys Kata Cloud containers on AWS/GCP. Configures domain allowlists and credential injection. Sets up SSO. Monitors agent usage across the organization.

**Key needs:** Self-hosted deployment (Docker, Kubernetes, VPC, on-prem). SSO/SAML. Audit logging. Network isolation and security controls. Usage analytics and cost attribution.

**Competitive alternative:** Tabnine Enterprise (air-gapped, but no spec-driven workflow). Amazon Q Developer (deep AWS integration, but no orchestration layer). Sourcegraph Cody Enterprise (cross-repo intelligence, but pivoted away from individual developers).

---

## 6. Core Workflows

### 6.1 Project Initialization

```
User                          Kata Cloud
  |                               |
  |-- "New project from repo" --->|
  |                               |-- Clone/detect repo
  |                               |-- Analyze codebase (brownfield detection)
  |                               |-- Read existing CLAUDE.md/docs
  |<-- Guided questions ----------|
  |    (vision, constraints,      |
  |     tech stack, conventions)  |
  |-- Answers ------------------->|
  |                               |-- Generate PROJECT.md
  |                               |-- Initialize config
  |                               |-- Create Linear project (optional)
  |<-- Project ready -------------|
```

### 6.2 Milestone Planning

```
User                          Kata Cloud
  |                               |
  |-- "Add milestone: v1.0" ---->|
  |                               |-- Gather requirements (guided)
  |<-- Requirement questions -----|
  |-- Requirements -------------->|
  |                               |-- Generate REQUIREMENTS.md with IDs
  |                               |-- Create ROADMAP.md (phases)
  |                               |-- Create GitHub Milestone
  |                               |-- Create Linear cycle
  |                               |-- Create GitHub Issues per phase
  |<-- Milestone plan ready ------|
  |                               |
  |-- "Plan phase 01" ---------->|
  |                               |-- Spawn researcher agent
  |                               |-- Spawn planner agent
  |                               |-- Spawn plan-checker agent
  |                               |-- Iterate until plans verified
  |<-- Phase plans ready ---------|
```

### 6.3 Agent Team Execution

```
User                          Kata Cloud                    Agent Teams
  |                               |                              |
  |-- "Execute phase 01" ------->|                              |
  |                               |-- Analyze plan dependencies  |
  |                               |-- Group into waves           |
  |                               |-- Create worktrees --------->|
  |                               |                              |
  |                               |  [Wave 1]                    |
  |                               |  Agent A: plan-01 ---------> worktree-01
  |                               |  Agent B: plan-02 ---------> worktree-02
  |                               |  (wait for wave 1 complete)  |
  |                               |  [Wave 2]                    |
  |                               |  Agent C: plan-03 ---------> worktree-03
  |                               |                              |
  |                               |-- Collect summaries          |
  |                               |-- Run verification agent     |
  |                               |-- Create PR per plan         |
  |<-- Phase execution report ----|                              |
  |                               |                              |
  |-- Review PRs in app ---------|                              |
  |-- "Merge all" -------------->|                              |
  |                               |-- Merge PRs in order         |
  |                               |-- Update Linear issues       |
  |                               |-- Clean worktrees            |
  |<-- Phase complete ------------|                              |
```

### 6.4 Verification and Gap Closure

```
User                          Kata Cloud
  |                               |
  |-- "Verify phase 01" -------->|
  |                               |-- Extract testable deliverables
  |                               |-- Present UAT checklist
  |<-- UAT items to test ---------|
  |-- Test results -------------->|
  |   (pass/fail per item)        |
  |                               |-- On failures:
  |                               |   |-- Spawn debugger agents
  |                               |   |-- Create fix plans
  |                               |   |-- Execute fixes
  |                               |   |-- Re-verify
  |<-- Phase verified ------------|
```

### 6.5 PR-Centric Output (Core Differentiator)

Every Kata Cloud workflow produces pull requests as its primary output. This is a deliberate differentiator. Most competing tools produce code changes that the user must manually commit, push, and PR. GitHub Copilot's coding agent creates PRs from issues but without structured specs or verification.

Kata's PR output includes: agent-created branches in isolated worktrees; atomic commits in conventional format tied to plan tasks; auto-generated PR descriptions from plan objectives and execution summaries; 6-agent parallel review suite before submission; one-click merge in dependency order; Linear issue closure on merge.

---

## 7. Feature Requirements

### 7.1 P0: Core Platform (MVP)

**CORE-01: Project Management.** Create projects from existing repositories. Guided project initialization with codebase analysis. PROJECT.md generation and maintenance. Config management (mode, depth, model profiles, integrations).

**CORE-02: Spec-Driven Workflow Engine.** Milestone creation with requirements gathering. Requirements traceability (ID assignment, phase mapping, completion tracking). Phase lifecycle (pending, active, completed). Plan generation with wave-based dependency analysis. Plan-as-prompt execution pattern. Verification loops with gap closure.

**CORE-03: Agent Team Orchestration.** Claude Agent SDK Agent Teams integration. Team lead + teammate spawning. Task creation, assignment, and dependency management. SendMessage coordination between agents. Wave-based parallel execution. Agent failure detection and retry. Cost tracking per agent session.

**CORE-04: Git Worktree Management.** Automatic worktree creation per plan/agent. Branch naming convention enforcement. Worktree cleanup after merge. Conflict detection between concurrent worktrees. Support for monorepos and submodules.

**CORE-05: GitHub Integration.** Repository operations (clone, branch, push). PR creation with auto-generated descriptions. PR review integration (request reviews, check status). Issue creation and lifecycle management. Milestone creation and tracking. Release creation with changelog generation. GitHub Actions status monitoring.

**CORE-06: Linear Integration.** Issue creation from phases. Cycle management mapped to milestones. Status sync (phase status to issue status). Label management. Project and team configuration.

**CORE-07: Integrated Git Client.** Visual diff viewer. Staging area management. One-click PR creation. Branch management. Merge queue with dependency ordering. Commit history visualization.

**CORE-08: Permission System.** Explore (read-only), Ask (approval), Execute (auto-approve) modes. Per-project permission configuration. Dangerous command blocking. Customizable allowlists/blocklists.

**CORE-09: Model Routing.** Quality/balanced/budget profiles. Per-task-type model assignment (research to Opus, execution to Sonnet, verification to Haiku). Claude Max subscription support. API key support for cloud mode.

**CORE-10: CLI Interface (First-Class).** All workflow operations available via `kata-cloud` command. Headless operation mode. JSON output for scripting. CI/CD pipeline integration. Competes as a terminal-native agent with workflow structure.

**CORE-11: MCP Compatibility.** Kata as MCP server (expose workflow engine to external tools). Kata as MCP client (consume external tool servers). Tool discovery and registration.

### 7.2 P1: Desktop and Web Apps

**APP-01: Desktop Application.** Electron + React (evolving from Kata Agents). Multi-session management with inbox/archive. Agent team visualization dashboard. Real-time execution progress. Permission mode cycling. Session status workflow. Keyboard shortcuts. Native notifications.

**APP-02: Web Application.** React SPA (shared component library with desktop). Cloud execution backend. Team workspace management. Responsive design for tablet/mobile monitoring.

### 7.3 P2: Advanced Features

**ADV-01: PR Review Suite.** 6 parallel review agents: code quality, test coverage, error handling, type design, comment accuracy, code simplification. Configurable review depth. Review results as PR comments or inline annotations. Review gate before merge.

**ADV-02: Channel Integrations.** Slack: trigger agent work from messages, post results to channels. Email: ingest bug reports, create sessions. Daemon mode for always-on monitoring.

**ADV-03: Plugin System.** KataPlugin interface (channels, tools, services). First-party plugins: Slack, GitHub, Linear, email. Third-party plugin loading.

**ADV-04: Template Customization.** Override plan, summary, UAT, verification, changelog templates. Per-project template storage. Template validation.

**ADV-05: Cost Analytics.** Per-agent token usage tracking. Per-phase and per-milestone cost aggregation. Model usage breakdown. Budget alerts and limits. ROI metrics (agent cost vs. estimated human time).

### 7.4 P3: Enterprise and Scale

**ENT-01: Deployment Flexibility.** Docker container images. Helm charts for Kubernetes. gVisor/Firecracker sandboxing. Network isolation with validating proxy. Domain allowlists. VPC deployment option. On-premises deployment option. Air-gapped deployment stretch goal (matching Tabnine's capability for defense/healthcare/banking).

**ENT-02: Team Management.** SSO/SAML authentication. Role-based access control. Team workspaces with shared projects. Audit logging with compliance export.

**ENT-03: Multi-Repository Orchestration.** Coordinate changes across multiple repos. Dependency-aware cross-repo PRs. Shared library update propagation.

**ENT-04: Compliance and Security.** SOC 2 Type 2 readiness. GDPR data handling. IP indemnification for agent-generated code. Zero-retention deployment option.

---

## 8. Execution Model

### 8.1 Local Mode (Claude Max)

```
User's Machine
+-- Kata Cloud Desktop App
|   +-- Electron main process
|   +-- React renderer
|   +-- Agent subprocesses (Bun)
|       +-- Agent Team Lead (Claude Agent SDK)
|       +-- Teammate 1 (worktree-01)
|       +-- Teammate 2 (worktree-02)
|       +-- Teammate N (worktree-N)
+-- Git worktrees (local filesystem)
+-- Claude Max subscription (direct API)
```

**Authentication:** Claude Max OAuth token (same as Claude Code)
**Cost:** Included in Claude Max subscription ($100/mo or $200/mo)
**Limits:** Claude Max rate limits apply
**Data:** All data stays local

### 8.2 Cloud Mode (SaaS)

```
Kata Cloud Infrastructure
+-- Web App (React SPA on CDN)
+-- API Server (Node.js)
|   +-- Project management
|   +-- Session management
|   +-- Integration orchestration
|   +-- Agent team dispatch
+-- Agent Execution Cluster
|   +-- Container per agent team
|   |   +-- Team Lead container
|   |   +-- Teammate containers (1-N)
|   |   +-- Shared volume (worktrees)
|   +-- gVisor sandboxing
|   +-- Network proxy (allowlists)
+-- Storage
|   +-- Project configs (PostgreSQL)
|   +-- Session history (object storage)
|   +-- Git repos (managed or user's remote)
+-- Integrations
    +-- GitHub API
    +-- Linear API
    +-- MCP servers
```

**Authentication:** Kata Cloud account + GitHub/Linear OAuth
**Cost:** SaaS subscription (tiered by concurrent agents and storage)
**Limits:** Plan-based concurrent agent teams, storage, API calls
**Data:** Cloud-hosted with optional self-hosted deployment

### 8.3 Self-Hosted Mode

Same architecture as Cloud Mode deployed on customer infrastructure. Requires: container runtime (Docker/Kubernetes), PostgreSQL, S3-compatible object storage, Claude API key (Teams/Enterprise plan), network egress to Claude API and GitHub/Linear.

Deployment options: standard cloud (SaaS managed), VPC (customer's cloud, Kata-managed), on-premises (fully customer-managed), air-gapped (stretch goal for regulated industries).

---

## 9. Pricing Model

### Local Mode (Claude Max)

| Tier | Price | Includes                                                                                          |
| ---- | ----- | ------------------------------------------------------------------------------------------------- |
| Free | $0    | Uses your Claude Max subscription. Desktop app + CLI. 1 concurrent agent team. No cloud features. |

### Cloud Mode (SaaS)

| Tier       | Price       | Includes                                                                                         |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------ |
| Starter    | $29/mo      | 1 user, 2 concurrent agent teams, 100 agent-hours/mo, GitHub + Linear integration                |
| Pro        | $79/mo      | 1 user, 5 concurrent agent teams, 500 agent-hours/mo, PR review suite, channel integrations      |
| Team       | $49/user/mo | Up to 20 users, 10 concurrent agent teams, 1000 agent-hours/mo, shared workspaces, audit logging |
| Enterprise | Custom      | SSO/SAML, self-hosted/VPC/on-prem, SLAs, dedicated support, custom integrations, compliance      |

**Agent-hours** = wall-clock time an agent team is executing. Includes all teammates in the team.

**Claude API costs** are pass-through at Anthropic's published rates (no markup). Users can bring their own API key or use Kata Cloud's pooled key.

### Pricing Context

Kata's pricing sits above free tools (Gemini CLI, GitHub Copilot Free, Amazon Q Developer free tier) and below enterprise platforms (Sourcegraph Cody at $59/user/mo, Tabnine Enterprise at $39/user/mo). The free local mode provides a competitive anchor against free/cheap alternatives. Cloud pricing targets teams who value workflow structure over raw model access.

Key competitive prices: Devin at $20/mo minimum (autonomous agent, no workflow structure). Augment Intent at $20-50/mo (closest workflow competitor). Kiro at $20/mo Pro (spec-driven IDE). Factory AI at custom enterprise pricing.

---

## 10. Technical Decisions

### 10.1 Why Claude Agent SDK (Not Model-Agnostic)

Agent Teams capability is unique to Claude Agent SDK; no other framework provides coordinated multi-agent teams with messaging and shared project context. Built-in tools (Read, Write, Edit, Bash, Glob, Grep) match exactly what coding agents need. Hooks system enables safety controls without LLM overhead. Session resume enables long-running workflows across interruptions. MCP support provides extensibility without framework lock-in on the tool side. Anthropic's deployment guidance (Docker, gVisor, Firecracker) aligns with cloud mode requirements. Anthropic commands 54% coding market share, validating the model quality bet.

**Trade-off:** Locked to Claude models. This is an intentional bet that Claude remains the best coding model. The MCP layer provides escape hatch for integrating other model capabilities as tools. If Poolside or Magic.dev produce superior coding models, MCP allows incorporating them without re-architecting.

### 10.2 Why Worktrees (Not Branches)

Worktrees allow multiple agents to work on the same repo simultaneously without merge conflicts. Each agent has a physical directory with full filesystem access. No context switching between branches; each worktree is independent. Cleanup is straightforward: `git worktree remove`. Aligns with how Augment Intent and 1Code handle parallel agent work.

### 10.3 Why Opinionated Workflow (Not Flexible)

Kata Orchestrator's 32 skills prove the workflow works for real projects. Opinionated workflows reduce decision fatigue for users. Consistent workflow enables better tooling (dashboards, analytics, templates). Users who want flexibility can override templates and configure depth/mode. Competitive differentiation: Tessl provides spec tooling; Kata enforces spec methodology. General-purpose orchestration frameworks (LangGraph, CrewAI) offer flexibility at the cost of requiring users to design their own workflows.

### 10.4 Why Electron Desktop + React Web (Not Pure Web)

Local mode requires native filesystem access for worktrees. Claude Max authentication flows use local tokens. Desktop app enables offline capability. Subprocess management requires main process control. Shared React component library minimizes duplication. Kata Agents provides a mature Electron codebase to evolve from.

### 10.5 Why CLI as First-Class (Not Afterthought)

The terminal has become the primary surface for agentic coding. Claude Code, Codex CLI, Gemini CLI, OpenCode, and Amp all bet on terminal-first. Kata's CLI competes in this tier with a structural advantage: workflow enforcement that terminal agents lack. CI/CD integration requires headless operation. Power users prefer terminal workflows. The CLI and desktop app share the same Kata Core API.

---

## 11. Success Metrics

### Product Metrics

| Metric                          | Target (6 months)   | Target (12 months) |
| ------------------------------- | ------------------- | ------------------ |
| Monthly active users            | 500                 | 5,000              |
| PRs created by agents           | 10,000              | 100,000            |
| Avg phases per milestone        | 5-8                 | 5-8                |
| Phase verification pass rate    | > 70% first pass    | > 85% first pass   |
| Avg time from spec to merged PR | < 2 hours per phase | < 1 hour per phase |

### Business Metrics

| Metric                     | Target (6 months) | Target (12 months) |
| -------------------------- | ----------------- | ------------------ |
| Paid cloud subscribers     | 50                | 500                |
| Monthly recurring revenue  | $5K               | $50K               |
| Local mode active installs | 200               | 2,000              |
| Enterprise contracts       | 0                 | 3                  |

### Quality Metrics

| Metric                                      | Target      |
| ------------------------------------------- | ----------- |
| Agent-generated code that passes CI         | > 80%       |
| PR review score (by human reviewers)        | > 3.5/5     |
| User-reported agent errors per 100 sessions | < 10        |
| Mean time to recover from agent failure     | < 5 minutes |

---

## 12. Risks and Mitigations

| Risk                                                                       | Impact                                                          | Likelihood | Mitigation                                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Agent SDK Agent Teams remains research preview                      | Cannot ship core multi-agent feature                            | Medium     | Build abstraction layer; fall back to subagent pattern if Teams not GA                                                                             |
| Claude Max rate limits too restrictive for parallel agents                 | Local mode unusable for large projects                          | Medium     | Queue-based execution; prioritize critical-path agents                                                                                             |
| Tessl ships a complete end-to-end workflow ($125M war chest, Snyk founder) | Direct competitive threat to spec-driven positioning            | High       | Differentiate on methodology enforcement and Claude-native experience; ship faster; build switching cost through Linear/GitHub depth               |
| GitHub Copilot adds spec-driven workflow features                          | Pricing premium collapses; distribution advantage overwhelming  | High       | Focus on depth of workflow value, not breadth; GitHub Spec Kit interop as hedge; target workflows Copilot's general-purpose approach cannot match  |
| Devin/Cognition expands from autonomous agent to structured workflows      | $10.2B valuation and $73M ARR fund rapid feature development    | Medium     | Kata's bet is that orchestration-first beats autonomy-first for team-based development; different user persona                                     |
| Factory AI's Droid model proves superior to dynamic agent teams            | Enterprise customers prefer pre-specialized agents              | Medium     | Kata's dynamic composition enables custom workflows Factory's fixed Droids cannot; monitor Factory's enterprise adoption                           |
| Open-source tools (OpenHands, OpenCode, Aider) erode willingness to pay    | Free local mode neutralized; cloud differentiation insufficient | Medium     | Build workflow value and team features that open-source cannot replicate; contribute to open-source ecosystem via MCP                              |
| Google Antigravity's free tier compresses market                           | Pricing pressure on cloud mode                                  | High       | Free local mode as competitive anchor; focus on workflow value over model access                                                                   |
| Pricing pressure from Devin at $20/mo, Gemini CLI free, Amazon Q free tier | Cannot sustain $29-79/mo cloud pricing                          | High       | Justify pricing through spec-to-PR workflow value, not model access; local mode free tier; consider usage-based pricing if flat rate unsustainable |
| Worktree management complexity at scale (> 10 concurrent)                  | Performance and reliability issues                              | Medium     | Limit concurrent worktrees; implement cleanup policies; test at scale early                                                                        |
| MCP ecosystem evolves in a direction incompatible with Kata's architecture | Integration strategy fails                                      | Low        | MCP is an open standard with broad adoption (Apple, GitHub, Anthropic); risk of incompatibility is low                                             |

---

## 13. Development Roadmap

### Phase 1: Foundation (Months 1-2)

**Objective:** Core workflow engine running locally with CLI interface.

Fork Kata Agents as desktop app base. Extract Kata Orchestrator workflow engine into shared TypeScript library. Implement Agent Teams integration with Claude Agent SDK. Build worktree manager. GitHub API integration (repos, branches, PRs). Linear API integration (issues, cycles). CLI interface for all workflow operations (first-class, not afterthought). Local mode with Claude Max authentication. MCP client support for custom tool servers.

### Phase 2: Desktop App + CLI Polish (Months 3-4)

**Objective:** Visual desktop app with agent team visualization. CLI competitive with Claude Code/Codex CLI.

Evolve Kata Agents UI for workflow-centric experience. Agent team dashboard (live status, progress, cost). Integrated git client with one-click PR. Spec editor with requirements management. Phase execution visualization (waves, agent progress). PR review integration. Notification system. CLI interactive mode with rich output.

### Phase 3: Cloud Mode (Months 5-6)

**Objective:** SaaS deployment with web app.

Cloud execution infrastructure (containers, sandboxing). API server for project/session management. Web app (React SPA). User authentication and workspace management. Billing and subscription management. MCP server support (expose Kata workflows to external tools). Self-hosted deployment documentation.

### Phase 4: Scale and Enterprise (Months 7-8)

**Objective:** Enterprise readiness and advanced features.

PR review suite (6 parallel agents). Channel integrations (Slack, email). Plugin system. Cost analytics dashboard. Template marketplace. SSO/SAML. Audit logging. VPC and on-prem deployment options. SOC 2 readiness work.

---

## 14. Open Questions

1. **Agent Teams GA timeline**: When will Claude Agent SDK Agent Teams exit research preview? Should we build a fallback orchestration layer?

2. **Worktree limits**: What is the practical limit for concurrent git worktrees on a single repo? At what point does filesystem or git performance degrade?

3. **Claude Max concurrency**: How many concurrent agent sessions can a Claude Max subscription support? Is there a documented rate limit?

4. **Linear vs. GitHub Issues**: Should Kata Cloud support both, or pick one as the canonical project management integration? Linear is richer but GitHub Issues is more universal.

5. **Mobile support**: Should the web app be mobile-optimized from day one? The primary use case is desktop.

6. **Plugin ecosystem timing**: When should third-party plugin support ship? Too early fragments the experience; too late and the platform feels closed.

7. **Pricing model validation**: Is agent-hours the right billing unit for cloud mode? Alternatives: per-PR, per-milestone, flat rate with overages, token-based credits. The market is moving toward lower prices (Devin $20/mo, multiple free tiers). Consider whether $29/mo Starter is sustainable or whether a lower entry point is needed.

8. **Tessl interop vs. competition**: Should Kata interoperate with Tessl's Spec Registry (consume its 10K+ specs) or compete directly? Interop reduces spec-creation friction; competition preserves control.

9. **GitHub Spec Kit compatibility**: Should Kata Cloud consume and produce GitHub Spec Kit-compatible Markdown specs? This would make Kata's workflow interoperable with 10+ other agents via an emerging open standard.

10. **MCP server priority**: Which external tools should Kata expose first via MCP? Candidates: workflow status, phase execution, PR review, cost analytics.

11. **Enterprise deployment priority**: VPC vs. on-prem vs. air-gapped. Tabnine is the only major competitor with air-gapped support. How early does Kata need this capability?

---

## Appendix A: Glossary

| Term          | Definition                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Project       | A repository + its Kata Cloud configuration and history                                              |
| Milestone     | A versioned release target (e.g., v1.0) with requirements and roadmap                                |
| Phase         | A logical unit of work within a milestone (e.g., "authentication", "dashboard")                      |
| Plan          | An atomic, executable specification for 2-3 tasks within a phase                                     |
| Wave          | A group of plans with no interdependencies, executed in parallel                                     |
| Agent Team    | A Claude Agent SDK team: one lead + N teammates coordinating on a phase                              |
| Worktree      | A git worktree providing an isolated filesystem for an agent to work in                              |
| Spec          | A specification document (PROJECT.md, REQUIREMENTS.md, PLAN.md) that doubles as an executable prompt |
| Verification  | Post-execution check confirming deliverables meet requirements                                       |
| Model Profile | A configuration mapping task types to Claude models (quality/balanced/budget)                        |
| MCP           | Model Context Protocol, the universal connector for agentic tool integration                         |
| Droid         | Factory AI's term for pre-specialized autonomous agents (used for competitive reference)             |

## Appendix B: Competitive Reference Links

- [GitHub Copilot](https://github.com/features/copilot)
- [Cognition / Devin](https://cognition.ai)
- [Tessl](https://tessl.io)
- [Factory AI](https://factory.ai)
- [Kiro (AWS)](https://kiro.dev)
- [Cursor](https://cursor.com)
- [Augment Code Intent](https://docs.augmentcode.com/intent/overview)
- [OpenAI Codex](https://developers.openai.com/codex/)
- [Google Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Warp Oz](https://docs.warp.dev/agent-platform/cloud-agents/cloud-agents-overview)
- [Replit Agent](https://replit.com)
- [OpenHands](https://github.com/All-Hands-AI/OpenHands)
- [OpenCode](https://github.com/nicepkg/OpenCode)
- [Aider](https://aider.chat)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [1Code](https://github.com/21st-dev/1code)
- [Team9](https://github.com/team9ai/team9)
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Tabnine Enterprise](https://tabnine.com/enterprise)
- [Amazon Q Developer](https://aws.amazon.com/q/developer/)
- [Sourcegraph Cody](https://sourcegraph.com/cody)
- [Lovable](https://lovable.dev)
- [Bolt.new](https://bolt.new)
- [CodeRabbit](https://coderabbit.ai)
- [Amp (Sourcegraph)](https://ampcode.com)
- [Kilo Code](https://kilocode.ai)

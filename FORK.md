# Fork notes — dsh-plugin-subscriptions

Upstream leads and this fork adapts. Everything here states what this fork owns
and why upstream cannot carry it.

## Authorization on a shared, authenticated channel

Upstream uses exact POST Fetch routes under `/api/subscriptions-auth.<endpoint>`.
This deployment requires the gateway's verified account identity on every
credential-management and quota request. The Fetch handler does not supply that
identity to the dispatcher.

The fork endpoints ride the shared `/api` channel through
`connection.rpc.intercept` under the `subscriptions-auth/` prefix, which is the
only path that carries the caller's transport-verified principal. Two role
checks act on it: only an administrator may change provider login credentials or
inspect the owner's quota, and a subaccount's `status` reply carries neither the
provider accounts nor the admin capability flags. `test/login.spec.ts` and
`test/usage.spec.ts` each cover the refusal.

## The `/image` command

`src/image-commands.ts` publishes `/image` over the same image-generation tool
upstream registers. Upstream has no command surface for it.

## Building against this deployment's Harness

`AuthenticatedPrincipal` and the four-parameter shared-channel handler exist in
this deployment's Harness build, not in the published packages, so the Harness
dependencies resolve through `link:` to a sibling `deepseek-harness` checkout
(`../../deepseek-harness` from this directory). Publishing that Harness build to
the internal registry would replace the links with ordinary versions; until then
the sibling checkout is required to type-check this package.

## What upstream absorbed

Upstream's `ProviderSettingsStore` supersedes this fork's hardcoded Codex and
Grok picker lists: it makes model visibility a durable per-provider preference
instead of a compiled-in allowlist, so the lists are gone. Upstream also owns
the Responses `strict` opt-out and the pool usage fixes this fork had carried.

## `fastTier` — withdrawing the Codex priority tier

Fast routes a request at `service_tier: priority`, which the provider bills at
a higher rate and reports back under the same model id. Nothing downstream can
separate the two afterwards: the session log's `request/header` records only
provider, model, reasoning effort and max tokens, so a per-model rate table
(dsh-spend's included) prices a fast call as if it were standard.

This deployment must not spend at that rate, so `fastTier: false` withdraws it
rather than leaving it visible and mispriced. The gate sits in three places
because the RPC is reachable without the UI: `speed()` reports no fast-capable
model (the state the UI already renders as a hidden toggle and an unavailable
`/fast`), `setSpeed()` refuses to store the tier, and `speedFor()` never sends
`service_tier`.

Upstream can carry this as an ordinary config field; offer it upstream before
carrying the divergence further.

## `anthropicToolId` —— 跨供应商工具 id 的字符清洗

Anthropic 要求 `tool_use.id` 匹配 `^[a-zA-Z0-9_-]+$`。工具调用 id 由**发起那次调用的供应商**生成，而一段会话可以换模型继续，于是 Claude 会收到自己从未签发过的 id。本部署的本地 OpenAI 兼容端点（`qwen3.8-27b-q4`）发的是 `call_<token>|fc_<token>`，其中的管道符让整个请求被拒：

```
HTTP 400 messages.1.content.0.tool_use.id: String should match pattern '^[a-zA-Z0-9_-]+$'
```

`src/translate/anthropic.ts` 里 `tool_use.id` 与 `tool_result.tool_use_id` 现在走同一个 `anthropicToolId`：合法 id 原样返回，非法 id 清洗为合法字符再缀上原串的 sha256(base64url) 前缀。缀哈希不是装饰——只把非法字符统一替换成 `_` 会让 `a.b` 与 `a-b` 塌成同一个 id，结果就会答到错误的调用上；base64url 的字母表恰好等于允许集合，不会重新引入问题。

两侧必须走同一个函数：Anthropic 校验的是「结果的 `tool_use_id` 是否等于前面某个 `tool_use.id`」，只改一侧会把字符错误换成配对错误。合并上游时若改动消息装配，须保持这一点。

## One React copy across the sibling checkouts

Upstream's `test/subscription-usage-badge.spec.ts` renders a client component
through `renderToStaticMarkup`. The component reaches `@deepseek-ai/dsh-client-ui-*`,
which this fork resolves by `link:` to the sibling Harness checkout, so that
package's `react/jsx-runtime` loads the Harness tree's React while the spec's
`react-dom/server` is bound to this package's own. Two React instances crash the
render with `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`.

`react` and `react-dom` therefore `link:` to the Harness virtual store's hoist
directory, the same physical copy the linked packages use. A deployed plugin
never sees this: it runs inside the Harness's own `node_modules`, where one
React already serves everything. `react-dom` is also declared here because the
spec imports `react-dom/server` and upstream relies on hoisting for it.

## Shared RPC test transport

`test/fake-connection.ts` records the shared-channel interceptor, applies its
endpoint predicate, and forwards the test caller's verified principal. The
login, usage, model-default and provider-settings cases use this common helper;
subaccount refusals stay covered alongside upstream provider and usage cases.

## 分支策略：只保留 main 与 dev

本仓库常驻分支只有两条：`main`（跟随上游发布）与 `dev`（部署分支，线上跑的就是它）。

任何临时分支——上游同步、部署批次、发布前备份——在工作完成后**合并进 `dev` 并立即删除本地与远端两侧**，不留长期分叉。删除前必须确认该分支的每个提交都能从 `dev` 到达（`git merge-base --is-ancestor <branch> dev`）：提交本身不会因删分支而丢失，但无人可达的提交等同于丢失。

2026-09-12 据此收敛：`codex/internal-013-deploy-20260908`（34 个提交）、`backup/pre-upstream-20260909`、`sync/upstream-20260902` 全部并入 `dev` 后删除。`dev` 落在 `2442684`，与当时线上部署的构件同一提交。

此后引用「部署分支」一律指 `dev`。

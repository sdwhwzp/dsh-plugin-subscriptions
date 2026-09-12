# Fork notes — dsh-plugin-subscriptions

Upstream leads and this fork adapts. Everything here states what this fork owns
and why upstream cannot carry it.

## Authorization on a shared, authenticated channel

Upstream registers its endpoints on a channel of its own with `loopback`
authority. This deployment puts every account behind one gateway, and that
gateway forwards a fixed prefix list, so a private channel never reaches the
Host at all — and `loopback` authority on one would admit every signed-in
account to the owner's provider credentials.

The endpoints therefore ride the shared `/api` channel through
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

## Antigravity 合并的适配点

合并 `upstream/feat/antigravity-subscription` 时，上游新增的 `test/provider-settings-rpc.spec.ts` 用 `rpc.handle` 桩连接，而本 fork 按 §1 注册在共享认证通道上的 `rpc.intercept`，于是 handler 永远为空。该测试已改用与本仓其他 RPC 测试相同的 intercept 桩（记录拦截器并补回端点前缀）。上游若把这套测试并进 main，合并时需要重复这一处适配。

README 的三处冲突同理：双方各自新增段落，保留 fork 的 ChatGPT/Grok 选择器段落，usage 段落采用上游版本（已含 Antigravity）。`test/login.spec.ts` 的子账号权限测试与上游的 antigravity 登录测试并存。

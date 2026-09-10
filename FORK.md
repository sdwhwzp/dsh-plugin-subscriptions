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

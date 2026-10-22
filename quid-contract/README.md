# Quid Contracts

Soroban (Rust) smart contracts for Quid: bounty escrow, reputation, milestone programs, referrals, disputes, badges, and protocol fees.

## Contracts

| Package | Wasm | Role |
|---------|------|------|
| `quid-store` | `quid_store.wasm` | Mission bounty vault: create, submit, payout, cancel, pause, slash |
| `quid-reputation` | `quid_reputation.wasm` | Admin, profiles, attestations |
| `quid-milestone-escrow` | `quid_milestone_escrow.wasm` | Multi-milestone escrow programs |
| `quid-referral` | `quid_referral.wasm` | Referral attribution + rewards on settled payouts |
| `quid-dispute` | `quid_dispute.wasm` | Contested-submission arbitration: timelock + optional arbiter |
| `quid-badge-nft` | `quid_badge_nft.wasm` | Badge NFTs for completed missions / reputation tiers |
| `quid-fee-collector` | `quid_fee_collector.wasm` | Protocol fee vault: configurable cut, per-token balances, admin withdrawal |
| `quid-mission-factory` | `quid_mission_factory.wasm` | Curated mission templates that launch into configured store instances |
| `quid-moderation-registry` | `quid_moderation_registry.wasm` | Shared ban/mute lists read by store gates (`submit_feedback`) |

## Reward tokens (testnet)

`create_mission` takes a `reward_token` that must be the **Stellar Asset Contract
(SAC) address** of the asset — not the classic `CODE:ISSUER` pair and not the
issuer address on its own. Passing an issuer or a classic asset makes mission
creation fail on-chain with `InvalidAsset`.

Use these verified values on **testnet** (`Test SDF Network ; September 2015`):

| Asset | Classic code:issuer | SAC contract id (`reward_token`) | How to get testnet funds |
|-------|--------------------|------------------------------------|---------------------------|
| XLM (native) | `native` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | Friendbot funds testnet accounts with XLM |
| USDC | `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | Circle testnet faucet — see below |

The USDC row is the **official Circle-issued** testnet asset. Testnet hosts
thousands of lookalike `USDC` assets from unverified issuers; using one of those
will deploy fine and then fail to settle. Always confirm the issuer ends in
`FLA5`.

### Getting testnet USDC

Friendbot only creates accounts with a native XLM balance, so USDC has to come
from a faucet. Ask for testnet USDC from the
[Circle testnet faucet](https://faucet.circle.com/), or from a community faucet,
then establish a trustline to the issuer:

```bash
stellar contract invoke \
  --id CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \
  --source alice \
  --network testnet \
  --send=yes \
  -- \
  changeTrusted \
  --issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --tlimit 100000
```

### Native XLM vs SAC wrapping

- **`native` is always available and needs no trustline.** It is the only asset
  Friendbot funds directly, so use it for local testing and CI.
- **Any other asset must be passed as its SAC contract id.** Contracts move
  value through SACs, so `reward_token` for USDC is the `CBIELT...` contract,
  not `USDC` and not the `GBBD47...` issuer.
- To resolve a SAC id yourself for an asset on either network:

  ```bash
  # for a classic asset
  stellar contract id asset --asset "USDC:GBBD47..." --network testnet
  # for native XLM
  stellar contract id asset --asset native --network testnet
  ```

### Verifying an address before you use it

Any SAC id can be checked against the chain, which is the fastest way to catch a
typo or a scam asset:

```bash
stellar contract invoke \
  --id <SAC_CONTRACT_ID> \
  --source alice \
  --network testnet \
  --send=no \
  -- \
  name
```

A correct USDC SAC prints `"USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"`
and the native SAC prints `"native"`.

## Prerequisites

- Rust (stable)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools) (`stellar`) — use a version compatible with Soroban SDK 23
- Testnet account (Friendbot)

> **Note on the `hello-world` scaffold:** the upstream Soroban template package
> `contracts/hello-world` was removed from this workspace. It was never
> referenced by Quid, and because the workspace globs `contracts/*` it was
> compiled, linted and snapshotted by every CI run for no benefit. New contracts
> should be scaffolded from an existing package here rather than from the
> upstream template.

```bash
stellar --version
stellar keys generate alice --network testnet --as-secret
stellar keys fund alice --network testnet
```

## Build

```bash
cd quid-contract
stellar contract build
```

Wasm output:

```text
target/wasm32v1-none/release/quid_store.wasm
target/wasm32v1-none/release/quid_reputation.wasm
target/wasm32v1-none/release/quid_milestone_escrow.wasm
target/wasm32v1-none/release/quid_referral.wasm
target/wasm32v1-none/release/quid_dispute.wasm
target/wasm32v1-none/release/quid_badge_nft.wasm
target/wasm32v1-none/release/quid_fee_collector.wasm
target/wasm32v1-none/release/quid_mission_factory.wasm
```

## Deployed on testnet

These are real, verified deployments on `Test SDF Network ; September 2015`.
Copy the ids into `frontend/.env.example` to point a local frontend at them.

| Contract | Testnet contract id | State |
|----------|---------------------|-------|
| `quid-reputation` | `CDXKNUE2ZNZRZLJI5BK6M2KBMLXLAY4ITWTZG6G3BZP2O2AMQKHRCEWC` | Deployed and initialized; `get_admin` verified |
| `quid-store` | `CAZL6GNSP42AOON45F6E55PUDNRS3RWOG6BCHKBTO4NWAWGOBIBPPYI7` | Deployed (issue #321); no `initialize` entrypoint, so nothing to configure. `get_mission_count` verified (returns `0`) |
| `quid-milestone-escrow` | `CBQPWWJXPA4Y5ONQOCNXTFLGU7NMM34YSA3JKIGUQY2TFHQ453E5Z2SV` | Deployed and initialized (issue #284); `get_admin` and `get_program_count` verified |

`quid-reputation` was initialized with the deploying account as the initial
admin. The admin secret is a throwaway Friendbot identity — **do not use this
contract for anything that needs a trusted admin.** Redeploy with your own
identity for real use:

```bash
# redeploy under your own identity
stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_reputation.wasm \
  --source alice \
  --network testnet

# then set the admin to your account
stellar contract invoke \
  --id <YOUR_REPUTATION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin <ALICE_PUBLIC_KEY>

# confirm
stellar contract invoke \
  --id <YOUR_REPUTATION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  --send=no \
  -- \
  get_admin
```

Both `quid-store` and `quid-milestone-escrow` were deployed with their own
throwaway Friendbot identity (same pattern as `quid-reputation`, different
keypair) — **do not use either for anything that needs a trusted admin or
real funds.** Redeploy with your own identity for real use, following the
same `stellar contract deploy` pattern as `quid-reputation`; for
`quid-milestone-escrow`, also re-run `initialize --admin <YOUR_PUBLIC_KEY>`
against the new id.

The remaining contracts in this workspace (`quid-referral`, `quid-dispute`,
`quid-badge-nft`, `quid-fee-collector`, `quid-mission-factory`) have not been
deployed to testnet yet; use the `## Deploy (testnet)` steps below.

## Deploy (testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_store.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_reputation.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_milestone_escrow.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_referral.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_dispute.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_badge_nft.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_fee_collector.wasm \
  --source alice \
  --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/quid_mission_factory.wasm \
  --source alice \
  --network testnet
```

Copy each `C...` contract ID into `frontend/.env.local`.

### Initialize reputation (once)

```bash
stellar contract invoke \
  --id <REPUTATION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin alice
```

Verify:

```bash
stellar contract invoke \
  --id <REPUTATION_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  get_admin
```

### Initialize referrals (once)

```bash
# 500 bps = 5% of each referred hunter's payout
stellar contract invoke \
  --id <REFERRAL_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin alice \
  --reward_bps 500

# only this address may report payouts
stellar contract invoke \
  --id <REFERRAL_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  set_payout_hook \
  --caller alice \
  --payout_hook <STORE_CONTRACT_ID>
```

### Initialize the fee collector (optional, once)

The protocol fee is opt-in: until the store is pointed at a vault,
`create_mission` charges nothing.

```bash
# 250 bps = 2.5%
stellar contract invoke \
  --id <FEE_COLLECTOR_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin alice \
  --fee_bps 250

stellar contract invoke \
  --id <STORE_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  set_fee_collector \
  --new_collector <FEE_COLLECTOR_CONTRACT_ID>
```

## Main entrypoints

### `quid-store`

- `create_mission` — escrow rewards, optional asset gate
- `submit_feedback` — hunter stake + IPFS CID
- `payout_participant` — pay hunter, refund stake
- `reject_submission` — owner-only; refunds the hunter's stake and marks the
  submission `Rejected` without consuming a payout slot (issue #321)
- `cancel_mission` / `pause_mission` / `update_mission_status`
- `slash_hunter_stake` / treasury helpers
- `set_fee_collector` / `get_fee_collector` — route the protocol fee to `quid-fee-collector`
- `set_moderation_registry` / `get_moderation_registry` — reject banned/muted hunters in `submit_feedback` via `quid-moderation-registry`

#### Event catalog and schema stability

`quid-store` contract events are part of the backend indexer's integration
contract. Topics are shown in order; event payload fields are encoded in the
order shown. Soroban `u64`/`u32`/`i128` values decode as integers and `Address`
values as Stellar addresses.

| Event name | Topics | Data fields | Emitted by |
|------------|--------|-------------|------------|
| `MissionCreateEvent` | `["mission", "create"]` | `mission_id: u64`, `owner: Address`, `title: String`, `description_cid: String`, `reward_token: Address`, `reward_amount: i128`, `max_participants: u32`, `created_at: u64` | `create_mission`, after the mission is stored and any protocol fee is handled |
| `SubNewEvent` | `["sub", "new"]` | `mission_id: u64`, `hunter: Address`, `ipfs_cid: String` | `submit_feedback`, after the submission and stake are stored |
| `PayoutDoneEvent` | `["payout", "done"]` | `mission_id: u64`, `hunter: Address` | `payout_participant`, after the reward is paid and submission marked paid |
| `SubmissionRejectedEvent` | `["sub", "reject"]` | `mission_id: u64`, `hunter: Address`, `stake_refunded: i128` | `reject_submission`, after the submission is marked `Rejected` and the stake is released (issue #321) |
| `MissionCancelEvent` | `["mission", "cancel"]` | `mission_id: u64` (single-value data) | `cancel_mission`, after cancellation and refunds |
| `MissionPauseEvent` | `["mission", "pause"]` | `mission_id: u64` (single-value data) | `pause_mission`, after the mission is paused |
| `FeeChargedEvent` | `["fee", "charged"]` | `mission_id: u64`, `token: Address`, `amount: i128` | `create_mission`, only when a non-zero protocol fee is charged |

`update_mission_status` emits no event. Adding a new event or changing an
existing topic, field order, field type, or single-value encoding requires a
reviewed schema change. Before merging such a change, update this catalog,
notify backend/indexer owners, version and deploy the contract/indexer
compatibility change together, and cover old and new event handling in tests.
Do not silently reuse an existing topic with a different payload.

### `quid-reputation`

- `initialize` / `get_admin`
- `issue_attestation` / `get_attestation` / `revoke_attestation`
- `set_profile` / `get_profile`

See [contracts/quid-reputation/README.md](./contracts/quid-reputation/README.md).

### `quid-referral`

- `initialize` / `set_reward_bps` / `compute_reward`
- `register_referral` / `get_referral` / `get_referred_count`
- `set_payout_hook` / `record_payout` — accrual gated behind a settled payout
- `fund` / `claim_reward` / `get_claimable` / `get_claimed`

See [contracts/quid-referral/README.md](./contracts/quid-referral/README.md).

### `quid-milestone-escrow`

- `create_program` / `add_milestone` / `approve_milestone` / `cancel_program`
- `initialize` / `get_admin` / `set_admin`
- getters for program / milestone status; `set_program_status` / `set_milestone_status` are admin only

### `quid-dispute`

- `create_dispute` — hunter opens a case, stakes a bond, sets timelock + optional arbiter
- `stake_bond` — hunter adds to their bond, or respondent posts a counter-bond
- `resolve_by_arbiter` — named arbiter awards the pot before the deadline
- `timeout_release` — after the deadline, refund each party's bond
- Events: `DisputeCreatedEvent`, `BondStakedEvent`, `DisputeResolvedEvent`, `DisputeTimeoutEvent`

### `quid-badge-nft`

- `initialize` / `get_admin` / `set_admin`
- `add_minter` / `remove_minter` / `is_minter`
- `mint_badge` / `get_badge` / `list_by_owner`
- `transfer` (transferable badges only) / `burn`

See [contracts/quid-badge-nft/README.md](./contracts/quid-badge-nft/README.md).

### `quid-fee-collector`

- `initialize` / `get_admin` / `set_admin`
- `set_fee_bps` / `get_fee_bps` / `compute_fee`
- `collect_fee` / `deposit_fee`
- `withdraw_fees` / `get_balance` / `get_balances`

See [contracts/quid-fee-collector/README.md](./contracts/quid-fee-collector/README.md).

### `quid-mission-factory`

- `initialize` / `get_admin`
- `register_template` / `get_template` / `list_templates`
- `create_from_template` — launch and fund a mission in the template's store

See [contracts/quid-mission-factory/README.md](./contracts/quid-mission-factory/README.md).

## Tests

```bash
cargo test
# or per package:
cargo test -p quid-store
cargo test -p quid-reputation
cargo test -p quid-milestone-escrow
cargo test -p quid-referral
cargo test -p quid-dispute
cargo test -p quid-badge-nft
cargo test -p quid-fee-collector
cargo test -p quid-mission-factory
```

## Known gaps (good contributor targets)

- Mission expiry / auto-refund
- Store → reputation hook on successful payout (also wires `quid-referral.record_payout`)
- Store/reputation → `quid-badge-nft` `mint_badge` call on successful payout
  (the badge contract already exposes the minter allow-list for it)
- Wire `quid-dispute` into store reject / payout holds

## Workspace layout

Members are picked up by the `contracts/*` glob in the workspace
`Cargo.toml`, so adding a directory is all it takes to add a contract — no
manifest edit required. The `Contracts` table above is the canonical list of
what Quid ships; the remaining entries under `contracts/` are unlisted
experiments.

A `contracts/hello-world` scaffold used to live here and was removed; see the
note under [Prerequisites](#prerequisites).

## Related docs

- Root: [../README.md](../README.md) — start with the [Deploy Checklist](../README.md#deploy-checklist)
  (build → deploy → initialize reputation → fill in FE/BE env)
- Root env vars: [../frontend/.env.example](../frontend/.env.example),
  [../backend/.env.example](../backend/.env.example)
- Frontend env: [../frontend/README.md](../frontend/README.md)
- Contributing: [../CONTRIBUTING.md](../CONTRIBUTING.md)

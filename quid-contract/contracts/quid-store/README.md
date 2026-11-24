# quid-store

Escrowed bounty marketplace. A creator escrows `reward_amount * max_participants`
up front, hunters submit work against a stake, and the creator pays out
individually. This contract holds the escrow, the submission ledger and the
stake bookkeeping, and it is the only place that moves a hunter's money.

Closes [#289](https://github.com/Quid-proquo/Quid/issues/289),
[#290](https://github.com/Quid-proquo/Quid/issues/290) and
[#292](https://github.com/Quid-proquo/Quid/issues/292).

## Entrypoints

| Function | Auth | Purpose |
|----------|------|---------|
| `create_mission(owner, title, description_cid, reward, max_participants, min_asset, expires_at)` | `owner` | Escrow `reward * max_participants` (+ protocol fee) and open a mission |
| `get_mission(mission_id)` | — | Full mission record, including `expires_at` |
| `submit_feedback(mission_id, hunter, ipfs_cid, stake_token, stake_amount)` | `hunter` | Submit against the mission, locking a stake |
| `update_submission(mission_id, hunter, new_cid)` | `hunter` | Replace the submitted CID while the mission is open |
| `payout_participant(mission_id, hunter)` | mission `owner` | Pay reward + release stake, then attest |
| `cancel_mission(mission_id)` | mission `owner` | Close early and refund the unpaid slots |
| `expire_mission(mission_id)` | — (permissionless) | Reclaim the unpaid slots once the deadline has passed |
| `is_mission_expired(mission_id)` | — | Whether the deadline has already been reached |
| `pause_mission(mission_id)` | mission `owner` | Pause submissions |
| `update_mission_status(mission_id, new_status)` | mission `owner` | Set the status directly |
| `slash_hunter_stake(mission_id, hunter, stake_token)` | mission `owner` | Confiscate a stake for spam |
| `set_treasury(new_treasury)` | current treasury, or the new one on first claim | Slash destination |
| `get_treasury()` | — | Current slash destination |
| `set_fee_collector(new_collector)` | current collector, or the new one on first claim | Protocol fee vault |
| `get_fee_collector()` | — | Current fee vault |
| `set_staking_pool(new_pool)` | current pool, or the new one on first claim | External staking vault |
| `get_staking_pool()` | — | Current staking vault |
| `set_reputation_contract(new_reputation)` | current registry, or the new one on first claim | Reputation registry to attest into |
| `get_reputation_contract()` | — | Current registry (`ReputationNotSet` when unwired) |
| `get_mission_count()` / `mission_exists(id)` | — | Read-only helpers |
| `set_mission_requirement(mission_id, req)` | mission `owner` | Set an optional proof-of-test target and function list before the first submission |
| `get_mission_requirement(mission_id)` | — | Get the optional proof-of-test requirement |

## Mission expiry

`expires_at` is an optional unix timestamp. `None` means "no deadline" and
behaves exactly like a mission created before this field existed.

- A mission is expired once `ledger.timestamp() >= expires_at` — the deadline
  second itself is already too late.
- `create_mission` rejects a deadline at or before the current timestamp
  (`ExpiryInThePast`), so a mission can never start out already expired.
- Once expired, `submit_feedback` fails with `MissionExpired`. Existing
  submissions survive: the owner can still pay out, slash or cancel them, so a
  deadline never strands work a hunter already delivered.
- `expire_mission` is **permissionless**. The deadline is public state, so
  requiring the owner's signature would only hand a departed founder a way to
  keep escrowed funds locked. It refunds
  `(max_participants - participants_count) * reward_amount` — the slots that
  were never paid out — to the owner, marks the mission `Cancelled`, emits
  `MissionExpiredEvent { mission_id, refunded }` and returns the amount.
- `expire_mission` before the deadline fails with `MissionNotExpired`; calling
  it twice fails with `MissionClosed`, so it cannot be used to drain the escrow
  a second time.

## Payout attestations

`payout_participant` issues a `quid-payout` attestation for the hunter against
the CID they submitted, in `quid-reputation`. The store acts as the *issuer* and
the registry's own admin is left alone, so the store never has to be an admin
and cannot revoke anyone else's records.

The wiring is opt-in. With no registry configured, `attest_payout` returns
immediately and the payout path is byte-for-byte what it was before — the
reputation integration cannot break a mission that predates it. A
`PayoutAttestedEvent { mission_id, attestation_id }` is emitted whenever an
attestation is actually written.

## Security notes

- **Money only ever moves on the owner's signature.** `payout_participant`,
  `cancel_mission`, `pause_mission`, `update_mission_status` and
  `slash_hunter_stake` all call `mission.owner.require_auth()` before touching
  storage or a token. A hunter's own submission stake is authorized by the
  hunter in `submit_feedback`. Nothing in this contract pays on the strength of
  the caller's identity alone.
- **`slash_hunter_stake` is owner-gated, not caller-gated.** The stake leaves
  the store to the configured treasury (or is forwarded to the staking pool),
  never to the hunter and never to the caller, so a mission owner can confiscate
  spam but cannot redirect the pot.
- **Singleton config slots use a claim-then-handover rule.** `set_treasury`,
  `set_fee_collector`, `set_staking_pool` and `set_reputation_contract` require
  the *new* address to authorize the first claim, so nobody can front-run a
  freshly deployed contract and point its treasury at themselves. Once claimed,
  only the current holder can move the slot.
- **`expire_mission` is intentionally the one permissionless money path.** It
  cannot pay anyone but the mission's own owner, only refunds slots that were
  never paid, and is idempotent-by-error rather than idempotent-by-silence.
  Keeping it owner-gated is what would actually lock funds.
- **Cross-contract calls are pre-authorized, not implicitly trusted.**
  `forward_fee` and `attest_payout` use `authorize_as_current_contract` with an
  explicit `SubContractInvocation`, because a contract's implicit auth only
  covers its own direct sub-call. The nested `transfer` / `issue_attestation` is
  therefore authorized for this store and nothing wider.
- **Protocol fees are bounded.** `quote_protocol_fee` rejects a vault that
  returns a negative fee or one larger than the value it was quoted against, so
  a misconfigured collector cannot take more than the mission is worth.
- **Arithmetic is checked.** Escrow totals, refunds and fees all go through
  `checked_mul` / `checked_add` and surface `NegativeReward` rather than
  wrapping.
- **Missions created with a deadline are still paid out normally.** Expiry only
  blocks *new* submissions; it does not claw back rewards already earned.

## Errors

| Code | Variant | When |
|------|---------|------|
| 1 | `MissionNotFound` | No mission with that id |
| 2 | `MissionClosed` | Already completed, cancelled or expired |
| 3 | `MissionFull` | Every slot is taken |
| 4 | `AlreadySubmitted` | This hunter already submitted |
| 5 | `InsufficientFunds` | Stake or escrow too small |
| 6 | `NotAuthorized` | Caller is not the mission owner |
| 7 | `NegativeReward` | Reward math would overflow or go negative |
| 8 | `InvalidState` | Mission is not in a state that allows the call |
| 9 | `AlreadyPaid` | This submission has been paid |
| 10 | `MissionNotOpen` | Mission is not accepting submissions |
| 11 | `SubmissionNotFound` | This hunter has no submission |
| 12 | `NotPending` | Submission is not awaiting payout |
| 13 | `InvalidAmount` | Non-positive stake, or a bad asset-gate amount |
| 14 | `TreasuryNotSet` | Slashing read the treasury before it was claimed |
| 15 | `StakeNotFound` | No stake locked for that (mission, hunter) |
| 16 | `InsufficientAssetBalance` | Asset gate not met |
| 17 | `FeeCollectorNotSet` | Fee vault read before it was claimed |
| 18 | `StakingPoolNotSet` | Staking pool read before it was claimed |
| 19 | `ExpiryInThePast` | `expires_at` is at or before the current timestamp |
| 20 | `MissionExpired` | Submission attempted after the deadline |
| 21 | `MissionNotExpired` | `expire_mission` called before the deadline |
| 22 | `ReputationNotSet` | Reputation registry read before it was configured |
| 26 | `InvalidRequirement` | Empty or more than 10 functions, or `window_end <= window_start` |
| 27 | `RequirementLocked` | Attempt to set or overwrite a requirement after the first submission |

## Mission test requirements

`TestRequirement` optionally identifies the on-chain target for a mission:
`target_contract`, `functions`, `network`, `window_start`, `window_end`, and
`proof_registry`. It is stored under `DataKey::Requirement(mission_id)`.
`set_mission_requirement` is owner-authorized and may be called repeatedly only
until the first submission. Requirements require one to ten function symbols
and a window end strictly after its start. Missions with no requirement behave
as before and do not enable proof enforcement.

`DataKey::Requirement(mission_id)` is a persistent storage entry. Its TTL is
extended whenever it is read or written. `DataKey::SubmissionCount(mission_id)`
is also persistent and is extended on submission writes and requirement-lock
checks.

## Wiring the optional collaborators

Each of these is independent and opt-in; do them in any order.

```bash
# slash destination
stellar contract invoke --id <STORE_ID> --source treasury --network testnet \
  -- set_treasury --new_treasury <TREASURY_ID>

# protocol fee vault (quid-fee-collector)
stellar contract invoke --id <STORE_ID> --source collector --network testnet \
  -- set_fee_collector --new_collector <FEE_COLLECTOR_ID>

# reputation registry (quid-reputation, already initialized)
stellar contract invoke --id <STORE_ID> --source registry --network testnet \
  -- set_reputation_contract --new_reputation <REPUTATION_ID>
```

## Events

| Topics | Payload | Emitted by |
|--------|---------|-----------|
| `mission, create` | `mission_id, owner` | `create_mission` |
| `sub, new` | `mission_id, hunter` | `submit_feedback` |
| `payout, done` | `mission_id, hunter` | `payout_participant` |
| `payout, attested` | `mission_id, attestation_id` | `payout_participant` (registry configured) |
| `mission, cancel` | `mission_id` | `cancel_mission` |
| `mission, expired` | `mission_id, refunded` | `expire_mission` |
| `mission, pause` | `mission_id` | `pause_mission` |
| `fee, charged` | `mission_id, token, amount` | `create_mission` (collector configured) |

## Tests

```bash
cargo test -p quid-store
```

The suite covers the happy path, capacity and double-spend guards, the fee
vault and staking pool integrations, plus negative authorization tests for
every owner-gated entrypoint.


## SC-012 / SC-022 storage

| Key | Purpose |
|-----|--------|
| `MissionTestRequirement(mission)` | Proof registry address for PoT gate |
| `MissionStakeTiers(mission)` | Reputation stake tiers |
| `HunterStake(mission, hunter)` | Actual staked amount (may be tier-reduced) |
| `SubmissionRateLimit` | Protocol-wide submission rate limit configuration (admin set) |
| `HunterWindow(hunter)` | Per-hunter rolling window counter for submissions (temporary storage) |

Per-record writes call `extend_ttl` where new keys are set.

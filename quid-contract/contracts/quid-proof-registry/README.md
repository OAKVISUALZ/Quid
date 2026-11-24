# quid-proof-registry

Proof-of-Test registry: verifier attestations, M-of-N thresholds, and hunter-submitted ed25519-signed proofs.

## Storage keys

| Key | Meaning | TTL |
|-----|---------|-----|
| `Verifier(Address)` | Registered verifier flag | extended on write |
| `VerifierKey(Address)` | Ed25519 public key | extended on write |
| `Proof(mission, hunter, tx_hash)` | Proof record | extended on write |
| `Attestations(mission, hunter, tx_hash)` | Verifier addresses | extended on write |
| `Threshold(mission)` | M-of-N threshold (default 1) | extended on write |
| `ValidProof(mission, hunter)` | Validity index for payouts | extended on write |
| `MissionProbe(mission)` | Configured quid-probe contract | extended on write |
| `ChallengeWindow(mission)` | Creator challenge period in seconds | extended on write |
| `ProofStatus(mission, hunter)` | Pending, valid, challenged, or rejected state | extended on write |
| `ProofCreatedAt(mission, hunter)` | Timestamp used for the challenge window | extended on write |
| `ChallengeReason(mission, hunter)` | Creator's reason CID | extended on write |

Creators can call `set_challenge_window` before proofs are recorded. During the
window, `has_valid_proof` remains false and `challenge_proof` can move a proof
to `Challenged`. The configured arbiter resolves it with `resolve_challenge`;
an upheld challenge becomes `Rejected`, while a rejected challenge becomes
`Valid`. This maps to quid-dispute by using its arbiter decision as the
`upheld` value.

Proof records include a `ProofSource` value (`Verifier`, `Signed`, or `Probe`).
After configuring the store, the mission owner can set its probe with
`set_mission_probe(caller, mission_id, probe)`. A hunter then calls
`claim_probe_proof(mission_id, hunter, function)`; the registry calls the
probe's `has_interaction` entrypoint and records a `Probe` proof only when it
returns true. Probe claims use the zero transaction hash and are therefore
single-use per mission and hunter.

Removing a verifier does **not** invalidate past attestations.

## Signed payload (SC-013 / BE-058)

Hunters call `submit_signed_proof` with an ed25519 signature over the XDR encoding of:

```text
SignedPayload {
  contract: Address,   // this registry contract id
  mission_id: u64,
  hunter: Address,
  tx_hash: BytesN<32>,
  data_cid: String,
  expires_at: u64,     // unix seconds; rejected if ledger timestamp >
}
```

Message bytes = `SignedPayload::to_xdr(env)` (Soroban XDR). Backend must sign the same bytes with the registered verifier key.

### Test vector (illustrative)

- `expires_at = 1700000000`
- Verify with `env.crypto().ed25519_verify(pubkey, payload_xdr, signature)`.

## Thresholds (SC-014)

`set_mission_threshold(mission_id, m)` — when store is configured, only the mission owner may set it; otherwise admin. Default threshold is **1**.

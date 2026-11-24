#![no_std]
// `create_mission` takes one argument per mission knob (title, description,
// reward, capacity, asset gate, deadline). The `#[contractimpl]` macro emits the
// matching client and trait methods at the same span, so the allowance has to
// live at crate level to cover them.
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contractevent, contractimpl, contracttype, vec, Address, Env,
    IntoVal, String, Symbol,
};

mod error;
mod types;

// Extension points. Keep new internal logic in these modules so parallel PRs
// don't all edit lib.rs. Public entrypoints still go in the #[contractimpl]
// block below and call into them.
mod fees;
mod guardian;
mod stream;
mod upgrade;

use error::QuidError;
use soroban_sdk::token;
use types::{
    DataKey, Mission, MissionStatus, Submission, SubmissionStatus, TestRequirement,
};

pub(crate) const TTL_THRESHOLD: u32 = 172800;
pub(crate) const TTL_EXTEND_TO: u32 = 5184000;
    DataKey, HunterWindowRecord, Mission, MissionStatus, RateLimit, StakeTiers, Submission,
    SubmissionStatus, TestRequirement,
};

/// `attestation_type` written on the reputation record a payout produces.
const PAYOUT_ATTESTATION_TYPE: &str = "quid-payout";

#[contractevent(topics = ["mission", "create"])]
pub struct MissionCreateEvent {
    pub mission_id: u64,
    pub owner: Address,
    pub title: String,
    pub description_cid: String,
    pub reward_token: Address,
    pub reward_amount: i128,
    pub max_participants: u32,
    pub created_at: u64,
}

#[contractevent(topics = ["sub", "new"])]
pub struct SubNewEvent {
    pub mission_id: u64,
    pub hunter: Address,
    pub ipfs_cid: String,
}

#[contractevent(topics = ["payout", "done"])]
pub struct PayoutDoneEvent {
    pub mission_id: u64,
    pub hunter: Address,
}

#[contractevent(topics = ["sub", "reject"])]
pub struct SubmissionRejectedEvent {
    pub mission_id: u64,
    pub hunter: Address,
    pub stake_refunded: i128,
}

#[contractevent(topics = ["mission", "cancel"], data_format = "single-value")]
pub struct MissionCancelEvent {
    pub mission_id: u64,
}

#[contractevent(topics = ["mission", "meta"])]
pub struct MissionMetadataUpdatedEvent {
    pub mission_id: u64,
    pub title: String,
    pub description_cid: String,
}

#[contracttype]
pub struct Reward {
    pub reward_token: Address,
    pub reward_amount: i128,
}

#[contracttype]
pub struct MinAsset {
    pub min_asset_token: Option<Address>,
    pub min_asset_amount: i128,
}

#[contractevent(topics = ["mission", "pause"], data_format = "single-value")]
pub struct MissionPauseEvent {
    pub mission_id: u64,
}

#[contractevent(topics = ["mission", "expired"])]
pub struct MissionExpiredEvent {
    pub mission_id: u64,
    pub refunded: i128,
}

#[contractevent(topics = ["payout", "attested"])]
pub struct PayoutAttestedEvent {
    pub mission_id: u64,
    pub attestation_id: u64,
}

#[contractevent(topics = ["fee", "charged"])]
pub struct FeeChargedEvent {
    pub mission_id: u64,
    pub token: Address,
    pub amount: i128,
}

/// Subset of `quid-fee-collector` this contract calls.
///
/// Declared as a client interface rather than a crate dependency so the store
/// wasm stays free of the collector's code.
#[contractclient(name = "FeeCollectorClient")]
pub trait FeeCollector {
    /// Fee owed on `gross_amount` at the vault's current rate.
    fn compute_fee(env: Env, gross_amount: i128) -> i128;

    /// Fee owed for a specific token, applying tiers/caps when configured.
    fn compute_fee_for(env: Env, token: Address, gross_amount: i128) -> i128;

    /// Pull an exact fee amount from `from` into the vault.
    fn deposit_fee(env: Env, from: Address, token: Address, amount: i128);
}

/// Subset of `quid-staking` used by the store. The pool only accepts calls
/// from lockers it has explicitly allow-listed.
#[contractclient(name = "StakingPoolClient")]
pub trait StakingPool {
    fn lock_for_mission(
        env: Env,
        locker: Address,
        mission_id: u64,
        hunter: Address,
        token_address: Address,
        amount: i128,
    );
    fn unlock_for_mission(
        env: Env,
        locker: Address,
        mission_id: u64,
        hunter: Address,
        token_address: Address,
    );
    fn slash_for_mission(
        env: Env,
        locker: Address,
        mission_id: u64,
        hunter: Address,
        token_address: Address,
    );
}

/// Subset of `quid-reputation` the store calls after a successful payout.
///
/// Declared as a client interface, like the fee collector above, so the store
/// wasm does not embed the reputation contract's code. The store is the
/// `issuer` of the attestation it issues on the hunter's behalf.
#[contractclient(name = "ReputationRegistryClient")]
pub trait ReputationRegistry {
    fn issue_attestation(
        env: Env,
        issuer: Address,
        subject: Address,
        attestation_type: String,
        data_cid: String,
    ) -> u64;
}

/// Subset of `quid-moderation-registry` the store reads (#305).
///
/// Declared as a client interface so the store wasm stays free of the
/// registry's code.
#[contractclient(name = "ModerationRegistryClient")]
pub trait ModerationRegistry {
    /// `false` while `address` is banned or muted.
    fn can_submit(env: Env, address: Address) -> bool;
}

/// Subset of `quid-proof-registry` used to gate payouts (SC-012).
#[contractclient(name = "ProofRegistryClient")]
pub trait ProofRegistry {
    fn has_valid_proof(env: Env, mission_id: u64, hunter: Address) -> bool;
}

/// Score read used for stake tiers (SC-022). Missing profile treated as 0 by caller.
#[contractclient(name = "ReputationScoreClient")]
pub trait ReputationScore {
    fn get_score(env: Env, subject: Address) -> u32;
}

#[contract]
pub struct QuidStoreContract;

#[contractimpl]
impl QuidStoreContract {
    fn bump_mission(env: &Env, mission_id: u64) {
        env.storage()
            .persistent()
            .extend_ttl(
                &DataKey::Mission(mission_id),
                TTL_THRESHOLD,
                TTL_EXTEND_TO,
            );
    }

    fn bump_submission(env: &Env, mission_id: u64, hunter: &Address) {
        env.storage()
            .persistent()
            .extend_ttl(
                &DataKey::Submission(mission_id, hunter.clone()),
                TTL_THRESHOLD,
                TTL_EXTEND_TO,
            );
    }

    fn bump_requirement(env: &Env, mission_id: u64) {
        env.storage()
            .persistent()
            .extend_ttl(
                &DataKey::Requirement(mission_id),
                TTL_THRESHOLD,
                TTL_EXTEND_TO,
            );
    }

    fn bump_submission_count(env: &Env, mission_id: u64) {
        env.storage()
            .persistent()
            .extend_ttl(
                &DataKey::SubmissionCount(mission_id),
                TTL_THRESHOLD,
                TTL_EXTEND_TO,
            );
    }

    /// Create mission
    ///
    /// `expires_at` is an optional unix timestamp. Once the ledger passes it the
    /// mission stops accepting submissions and anyone may call `expire_mission`
    /// to return the unspent escrow to the owner. `None` means "no deadline",
    /// which keeps the pre-expiry behaviour for callers that do not care.
    pub fn create_mission(
        env: Env,
        owner: Address,
        title: String,
        description_cid: String,
        reward: Reward,
        max_participants: u32,
        min_asset: MinAsset,
        expires_at: Option<u64>,
    ) -> Result<u64, QuidError> {
        owner.require_auth();

        Self::validate_mission_params(&title, reward.reward_amount)?;

        let created_at = env.ledger().timestamp();
        Self::validate_expiry(expires_at, created_at)?;

        // Validate optional asset gating
        if min_asset.min_asset_token.is_some() && min_asset.min_asset_amount <= 0 {
            return Err(QuidError::InvalidAmount);
        }

        let total_needed: i128 = reward
            .reward_amount
            .checked_mul(max_participants as i128)
            .ok_or(QuidError::NegativeReward)?;

        // The protocol fee is charged on top of the escrow, so the full reward
        // pool stays available to hunters. Zero when no collector is configured.
        let fee = Self::quote_protocol_fee(&env, &reward.reward_token, total_needed)?;
        let owner_debit = total_needed
            .checked_add(fee)
            .ok_or(QuidError::NegativeReward)?;

        let token_client = token::Client::new(&env, &reward.reward_token);
        token_client.transfer(&owner, env.current_contract_address(), &owner_debit);

        let mission_id = Self::get_next_mission_id(&env);

        // let reward = Reward {
        //     reward_token,
        //     reward_amount
        // }

        let mission = Mission {
            id: mission_id,
            owner: owner.clone(),
            title,
            description_cid,
            reward_token: reward.reward_token,
            reward_amount: reward.reward_amount,
            max_participants,
            participants_count: 0,
            status: MissionStatus::Open,
            created_at,
            min_asset: min_asset.min_asset_token,
            min_asset_amount: min_asset.min_asset_amount,
            expires_at,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Mission(mission_id), 5184000, 5184000);

        if fee > 0 {
            let collector = Self::get_fee_collector(env.clone())?;
            Self::forward_fee(&env, &collector, &mission.reward_token, fee);

            FeeChargedEvent {
                mission_id,
                token: mission.reward_token.clone(),
                amount: fee,
            }
            .publish(&env);
        }

        MissionCreateEvent {
            mission_id,
            owner,
            title: mission.title,
            description_cid: mission.description_cid,
            reward_token: mission.reward_token,
            reward_amount: mission.reward_amount,
            max_participants: mission.max_participants,
            created_at,
        }
        .publish(&env);

        Ok(mission_id)
    }

    /// Get mission
    pub fn get_mission_owner(env: Env, mission_id: u64) -> Result<Address, QuidError> {
        Ok(Self::get_mission(env, mission_id)?.owner)
    }

    pub fn get_mission(env: Env, mission_id: u64) -> Result<Mission, QuidError> {
        let mission = env
            .storage()
            .persistent()
            .get(&DataKey::Mission(mission_id))
            .ok_or(QuidError::MissionNotFound)?;
        Self::bump_mission(&env, mission_id);
        Ok(mission)
    }

    /// Get a single hunter submission, including its current review status.
    pub fn get_submission(
        env: Env,
        mission_id: u64,
        hunter: Address,
    ) -> Result<Submission, QuidError> {
        let submission = env
            .storage()
            .persistent()
            .get(&DataKey::Submission(mission_id, hunter))
            .ok_or(QuidError::SubmissionNotFound)?;
        Self::bump_submission(&env, mission_id, &hunter);
        Ok(submission)
    }

    /// Set the proof-of-test requirement for a mission.
    ///
    /// Requirements may be set or overwritten until the first submission. This
    /// preserves the old mission creation signature and leaves missions
    /// without a requirement behaving exactly as before.
    pub fn set_mission_requirement(
        env: Env,
        mission_id: u64,
        req: TestRequirement,
    ) -> Result<(), QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();

        let submission_count = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::SubmissionCount(mission_id));
        if submission_count.is_some() {
            Self::bump_submission_count(&env, mission_id);
        }
        if submission_count.unwrap_or(0) > 0 {
            return Err(QuidError::RequirementLocked);
        }

        if req.functions.is_empty() || req.functions.len() > 10 {
            return Err(QuidError::InvalidRequirement);
        }
        if req.window_end <= req.window_start {
            return Err(QuidError::InvalidRequirement);
        }

        let key = DataKey::Requirement(mission_id);
        env.storage().persistent().set(&key, &req);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// Get the optional proof-of-test requirement for a mission.
    pub fn get_mission_requirement(
        env: Env,
        mission_id: u64,
    ) -> Option<TestRequirement> {
        let key = DataKey::Requirement(mission_id);
        let requirement = env.storage().persistent().get(&key);
        if requirement.is_some() {
            Self::bump_requirement(&env, mission_id);
        }
        requirement
    }

    /// SC-011/SC-012: require a valid proof in `registry` before payout.
    pub fn set_test_requirement(
        env: Env,
        mission_id: u64,
        registry: Address,
    ) -> Result<(), QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();
        let key = DataKey::MissionTestRequirement(mission_id);
        env.storage()
            .persistent()
            .set(&key, &TestRequirement { registry });
        env.storage()
            .persistent()
            .extend_ttl(&key, 100_000, 500_000);
        Ok(())
    }

    /// SC-022: configure reputation-scaled stake tiers for a mission.
    pub fn set_stake_tiers(env: Env, mission_id: u64, tiers: StakeTiers) -> Result<(), QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();
        if tiers.thresholds.len() != tiers.bps.len() || tiers.thresholds.is_empty() {
            return Err(QuidError::InvalidStakeTiers);
        }
        for i in 1..tiers.bps.len() {
            if tiers.bps.get(i).unwrap() > tiers.bps.get(i - 1).unwrap() {
                return Err(QuidError::InvalidStakeTiers);
            }
        }
        let key = DataKey::MissionStakeTiers(mission_id);
        env.storage().persistent().set(&key, &tiers);
        env.storage()
            .persistent()
            .extend_ttl(&key, 100_000, 500_000);
        Ok(())
    }

    /// Set protocol-wide submission rate limit (SC-021).
    /// Admin authorization required.
    pub fn set_rate_limit(env: Env, admin: Address, config: Option<RateLimit>) {
        admin.require_auth();
        let key = DataKey::SubmissionRateLimit;
        if let Some(cfg) = config {
            env.storage().instance().set(&key, &cfg);
        } else {
            env.storage().instance().remove(&key);
        }
    }

    /// Get current protocol-wide submission rate limit (SC-021).
    pub fn get_rate_limit(env: Env) -> Option<RateLimit> {
        env.storage().instance().get(&DataKey::SubmissionRateLimit)
    }

    /// Check and record hunter submission under the rolling rate limit window (SC-021).
    fn check_and_update_rate_limit(env: &Env, hunter: &Address) -> Result<(), QuidError> {
        let rate_limit: Option<RateLimit> =
            env.storage().instance().get(&DataKey::SubmissionRateLimit);

        let Some(limit) = rate_limit else {
            return Ok(());
        };

        let now = env.ledger().timestamp();
        let key = DataKey::HunterWindow(hunter.clone());
        let current_window: Option<HunterWindowRecord> = env.storage().temporary().get(&key);

        let record = match current_window {
            Some(w) if now < w.window_start.saturating_add(limit.window_secs) => {
                if w.count >= limit.max {
                    return Err(QuidError::RateLimited);
                }
                HunterWindowRecord {
                    window_start: w.window_start,
                    count: w.count.saturating_add(1),
                }
            }
            _ => HunterWindowRecord {
                window_start: now,
                count: 1,
            },
        };

        let ttl_ledgers = ((limit.window_secs / 5) + 1).max(1) as u32;
        env.storage().temporary().set(&key, &record);
        env.storage()
            .temporary()
            .extend_ttl(&key, ttl_ledgers, ttl_ledgers);

        Ok(())
    }

    fn compute_tier_stake(env: &Env, mission_id: u64, hunter: &Address, base: i128) -> i128 {
        let tiers: Option<StakeTiers> = env
            .storage()
            .persistent()
            .get(&DataKey::MissionStakeTiers(mission_id));
        let Some(tiers) = tiers else {
            return base;
        };
        let score = if let Some(rep) = Self::reputation_contract(env) {
            ReputationScoreClient::new(env, &rep).get_score(hunter)
        } else {
            0u32
        };
        let mut chosen_bps = tiers.bps.get(0).unwrap_or(10_000);
        for i in 0..tiers.thresholds.len() {
            let th = tiers.thresholds.get(i).unwrap();
            if score >= th {
                chosen_bps = tiers.bps.get(i).unwrap();
            }
        }
        base.checked_mul(chosen_bps as i128).unwrap_or(base) / 10_000
    }

    pub fn submit_feedback(
        env: Env,
        mission_id: u64,
        hunter: Address,
        ipfs_cid: String,
        stake_token: Address,
        stake_amount: i128,
    ) -> Result<(), QuidError> {
        hunter.require_auth();

        // Moderation gate (#305): with a registry configured, a banned or
        // muted hunter is rejected before any stake moves or state changes.
        // Stores without a registry keep their existing behaviour.
        if let Some(registry) = Self::moderation_registry(&env) {
            if !ModerationRegistryClient::new(&env, &registry).can_submit(&hunter) {
                return Err(QuidError::HunterBanned);
            }
        }

        let mission = Self::get_mission(env.clone(), mission_id)?;

        if Self::is_expired(&mission, env.ledger().timestamp()) {
            return Err(QuidError::MissionExpired);
        }

        Self::check_and_update_rate_limit(&env, &hunter)?;

        if mission.status != MissionStatus::Open && mission.status != MissionStatus::Started {
            return Err(QuidError::MissionNotOpen);
        }
        if mission.participants_count >= mission.max_participants {
            return Err(QuidError::MissionFull);
        }

        // Check asset gating requirement
        if let Some(asset_address) = &mission.min_asset {
            let asset_client = token::Client::new(&env, asset_address);
            let current_balance = asset_client.balance(&hunter);
            if current_balance < mission.min_asset_amount {
                return Err(QuidError::InsufficientAssetBalance);
            }
        }

        let key = DataKey::Submission(mission_id, hunter.clone());

        if env.storage().persistent().has(&key) {
            return Err(QuidError::AlreadySubmitted);
        }

        if stake_amount <= 0 {
            return Err(QuidError::InvalidAmount);
        }

        let actual_stake = Self::compute_tier_stake(&env, mission_id, &hunter, stake_amount);
        if actual_stake <= 0 {
            return Err(QuidError::InvalidAmount);
        }

        if let Some(pool) = Self::staking_pool(&env) {
            StakingPoolClient::new(&env, &pool).lock_for_mission(
                &env.current_contract_address(),
                &mission_id,
                &hunter,
                &stake_token,
                &actual_stake,
            );
        } else {
            let token_client = token::Client::new(&env, &stake_token);
            token_client.transfer(&hunter, env.current_contract_address(), &actual_stake);
        }

        let stake_key = DataKey::HunterStake(mission_id, hunter.clone());
        env.storage().persistent().set(&stake_key, &actual_stake);
        env.storage()
            .persistent()
            .extend_ttl(&stake_key, 5184000, 5184000);

        let submission = Submission {
            hunter: hunter.clone(),
            ipfs_cid,
            status: SubmissionStatus::Pending,
            submitted_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &submission);
        env.storage()
            .persistent()
            .extend_ttl(&key, 5184000, 5184000);

        let count_key = DataKey::SubmissionCount(mission_id);
        let submission_count = env
            .storage()
            .persistent()
            .get::<_, u32>(&count_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&count_key, &(submission_count.saturating_add(1)));
        env.storage()
            .persistent()
            .extend_ttl(&count_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        SubNewEvent {
            mission_id,
            hunter,
            ipfs_cid: submission.ipfs_cid,
        }
        .publish(&env);

        Ok(())
    }

    /// Update Submission
    pub fn update_submission(
        env: Env,
        mission_id: u64,
        hunter: Address,
        new_ipfs_cid: String,
    ) -> Result<(), QuidError> {
        hunter.require_auth();

        let mission = Self::get_mission(env.clone(), mission_id)?;

        if Self::is_expired(&mission, env.ledger().timestamp()) {
            return Err(QuidError::MissionExpired);
        }

        if mission.status != MissionStatus::Open {
            return Err(QuidError::MissionNotOpen);
        }

        let key = DataKey::Submission(mission_id, hunter.clone());

        if !env.storage().persistent().has(&key) {
            return Err(QuidError::SubmissionNotFound);
        }

        let submission: Submission = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuidError::SubmissionNotFound)?;

        if submission.status == SubmissionStatus::Paid {
            return Err(QuidError::AlreadyPaid);
        }
        if submission.status == SubmissionStatus::Rejected {
            return Err(QuidError::AlreadyRejected);
        }

        let updated_submission = Submission {
            hunter: submission.hunter,
            ipfs_cid: new_ipfs_cid,
            status: submission.status,
            submitted_at: submission.submitted_at,
        };

        env.storage().persistent().set(&key, &updated_submission);
        env.storage()
            .persistent()
            .extend_ttl(&key, 5184000, 5184000);

        Ok(())
    }

    /// Payout Participant
    pub fn payout_participant(env: Env, mission_id: u64, hunter: Address) -> Result<(), QuidError> {
        let mut mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();

        if matches!(
            mission.status,
            MissionStatus::Completed | MissionStatus::Cancelled
        ) {
            return Err(QuidError::MissionClosed);
        }

        let key = DataKey::Submission(mission_id, hunter.clone());
        let mut submission: Submission = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuidError::SubmissionNotFound)?;

        if submission.status == SubmissionStatus::Paid {
            return Err(QuidError::AlreadyPaid);
        }
        if submission.status != SubmissionStatus::Pending {
            return Err(QuidError::NotPending);
        }

        // SC-012: if a test requirement is set, require a valid proof before payout.
        if let Some(req) = env
            .storage()
            .persistent()
            .get::<DataKey, TestRequirement>(&DataKey::MissionTestRequirement(mission_id))
        {
            let ok =
                ProofRegistryClient::new(&env, &req.registry).has_valid_proof(&mission_id, &hunter);
            if !ok {
                return Err(QuidError::ProofMissing);
            }
        }

        let token_client = token::Client::new(&env, &mission.reward_token);
        token_client.transfer(
            &env.current_contract_address(),
            &hunter,
            &mission.reward_amount,
        );

        Self::release_stake(
            &env,
            mission_id,
            hunter.clone(),
            mission.reward_token.clone(),
        );

        submission.status = SubmissionStatus::Paid;
        env.storage().persistent().set(&key, &submission);

        mission.participants_count += 1;
        if mission.max_participants > 0 && mission.participants_count >= mission.max_participants {
            mission.status = MissionStatus::Completed;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);

        PayoutDoneEvent {
            mission_id,
            hunter: hunter.clone(),
        }
        .publish(&env);

        // Reputation is opt-in: a store with no registry configured pays out
        // exactly as before, so wiring this up is non-breaking.
        Self::attest_payout(&env, mission_id, &hunter, &submission.ipfs_cid)?;

        Ok(())
    }

    /// Reject a pending submission and hand the hunter's stake back.
    ///
    /// Owner-only, mirroring `payout_participant`. A rejected submission is
    /// final: it can neither be updated, paid, nor rejected again, and the slot
    /// stays free for another hunter. Rejecting is the polite path — the stake
    /// is returned in full, so use `slash_hunter_stake` for spam.
    pub fn reject_submission(env: Env, mission_id: u64, hunter: Address) -> Result<(), QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();

        if matches!(
            mission.status,
            MissionStatus::Completed | MissionStatus::Cancelled
        ) {
            return Err(QuidError::MissionClosed);
        }

        let key = DataKey::Submission(mission_id, hunter.clone());
        let mut submission: Submission = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuidError::SubmissionNotFound)?;

        if submission.status == SubmissionStatus::Paid {
            return Err(QuidError::AlreadyPaid);
        }
        if submission.status == SubmissionStatus::Rejected {
            return Err(QuidError::AlreadyRejected);
        }
        if submission.status != SubmissionStatus::Pending {
            return Err(QuidError::NotPending);
        }

        let stake_refunded =
            Self::release_stake(&env, mission_id, hunter.clone(), mission.reward_token);

        submission.status = SubmissionStatus::Rejected;
        env.storage().persistent().set(&key, &submission);
        env.storage()
            .persistent()
            .extend_ttl(&key, 5184000, 5184000);

        SubmissionRejectedEvent {
            mission_id,
            hunter,
            stake_refunded,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_mission(env: Env, mission_id: u64) -> Result<(), QuidError> {
        let mut mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();

        if matches!(
            mission.status,
            MissionStatus::Cancelled | MissionStatus::Completed
        ) {
            return Err(QuidError::MissionClosed);
        }

        let remaining_slots = mission
            .max_participants
            .saturating_sub(mission.participants_count);
        let refund_amount: i128 = (remaining_slots as i128)
            .checked_mul(mission.reward_amount)
            .ok_or(QuidError::NegativeReward)?;

        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &mission.reward_token);
            token_client.transfer(
                &env.current_contract_address(),
                &mission.owner,
                &refund_amount,
            );
        }

        mission.status = MissionStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);

        MissionCancelEvent { mission_id }.publish(&env);

        Ok(())
    }

    /// Edit mission metadata before the first submission arrives.
    pub fn update_mission_metadata(
        env: Env,
        mission_id: u64,
        title: Option<String>,
        description_cid: Option<String>,
    ) -> Result<(), QuidError> {
        let mut mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();

        if mission.participants_count != 0 {
            return Err(QuidError::InvalidState);
        }

        if let Some(ref t) = title {
            Self::validate_mission_params(t, mission.reward_amount)?;
            mission.title = t.clone();
        }

        if let Some(ref cid) = description_cid {
            mission.description_cid = cid.clone();
        }

        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Mission(mission_id), 5184000, 5184000);

        MissionMetadataUpdatedEvent {
            mission_id,
            title: mission.title.clone(),
            description_cid: mission.description_cid.clone(),
        }
        .publish(&env);

        Ok(())
    }

    /// Reclaim the escrow of a mission whose deadline has passed.
    ///
    /// Deliberately permissionless: once the ledger timestamp reaches
    /// `expires_at` the deadline is public state, so requiring the owner's
    /// signature would only give a departed founder a way to keep escrowed
    /// funds locked. Anyone may call it, and it is safe to call twice — the
    /// second attempt hits the closed-mission check.
    pub fn expire_mission(env: Env, mission_id: u64) -> Result<i128, QuidError> {
        let mut mission = Self::get_mission(env.clone(), mission_id)?;

        if matches!(
            mission.status,
            MissionStatus::Cancelled | MissionStatus::Completed
        ) {
            return Err(QuidError::MissionClosed);
        }

        let now = env.ledger().timestamp();
        if !Self::is_expired(&mission, now) {
            return Err(QuidError::MissionNotExpired);
        }

        // Slots already paid out keep their reward; everything still escrowed
        // goes back to the founder.
        let remaining_slots = mission
            .max_participants
            .saturating_sub(mission.participants_count);
        let refund_amount: i128 = (remaining_slots as i128)
            .checked_mul(mission.reward_amount)
            .ok_or(QuidError::NegativeReward)?;

        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &mission.reward_token);
            token_client.transfer(
                &env.current_contract_address(),
                &mission.owner,
                &refund_amount,
            );
        }

        mission.status = MissionStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);

        MissionExpiredEvent {
            mission_id,
            refunded: refund_amount,
        }
        .publish(&env);

        Ok(refund_amount)
    }

    /// Whether the deadline (if any) has already passed for this mission.
    pub fn is_mission_expired(env: Env, mission_id: u64) -> Result<bool, QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        Ok(Self::is_expired(&mission, env.ledger().timestamp()))
    }

    pub fn pause_mission(env: Env, id: u64) -> Result<(), QuidError> {
        let mut mission = Self::get_mission(env.clone(), id)?;
        mission.owner.require_auth();
        mission.status = MissionStatus::Paused;
        env.storage()
            .persistent()
            .set(&DataKey::Mission(id), &mission);

        MissionPauseEvent { mission_id: id }.publish(&env);
        Ok(())
    }

    pub fn update_mission_status(
        env: Env,
        mission_id: u64,
        new_status: MissionStatus,
    ) -> Result<(), QuidError> {
        let mut mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();
        mission.status = new_status;
        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);
        Ok(())
    }

    /// Slash a hunter's stake for spam submissions.
    /// Only the mission owner may invoke this.
    pub fn slash_hunter_stake(
        env: Env,
        mission_id: u64,
        hunter: Address,
        stake_token: Address,
    ) -> Result<(), QuidError> {
        let mission = Self::get_mission(env.clone(), mission_id)?;
        mission.owner.require_auth();
        Self::slash_stake(&env, mission_id, hunter, stake_token)
    }

    /// Configure the reusable hunter stake pool. The pool must separately
    /// allow-list this store with `set_locker` before pooled submissions work.
    pub fn set_staking_pool(env: Env, new_pool: Address) {
        if let Some(current) = Self::staking_pool(&env) {
            current.require_auth();
        } else {
            new_pool.require_auth();
        }
        env.storage()
            .instance()
            .set(&DataKey::StakingPool, &new_pool);
    }

    pub fn get_staking_pool(env: Env) -> Result<Address, QuidError> {
        Self::staking_pool(&env).ok_or(QuidError::StakingPoolNotSet)
    }

    pub fn get_mission_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MissionCount)
            .unwrap_or(0)
    }

    pub fn mission_exists(env: Env, mission_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Mission(mission_id))
    }

    fn validate_mission_params(_title: &String, reward_amount: i128) -> Result<(), QuidError> {
        if reward_amount <= 0 {
            return Err(QuidError::NegativeReward);
        }
        Ok(())
    }

    /// A deadline in the past would create a mission that can never be
    /// submitted to and is immediately refundable, so reject it at creation.
    fn validate_expiry(expires_at: Option<u64>, now: u64) -> Result<(), QuidError> {
        if let Some(deadline) = expires_at {
            if deadline <= now {
                return Err(QuidError::ExpiryInThePast);
            }
        }
        Ok(())
    }

    /// `expires_at: None` never expires.
    fn is_expired(mission: &Mission, now: u64) -> bool {
        matches!(mission.expires_at, Some(deadline) if now >= deadline)
    }

    fn get_next_mission_id(env: &Env) -> u64 {
        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MissionCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::MissionCount, &count);
        count
    }

    fn staking_pool(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::StakingPool)
    }

    /// Point the store at a `quid-moderation-registry` (#305).
    ///
    /// Same handover rule as `set_fee_collector`: the first caller must
    /// authorize as the new registry, and afterwards only the current
    /// registry can move the slot.
    pub fn set_moderation_registry(env: Env, new_registry: Address) {
        if let Some(current) = Self::moderation_registry(&env) {
            current.require_auth();
        } else {
            new_registry.require_auth();
        }
        env.storage()
            .instance()
            .set(&DataKey::ModerationRegistry, &new_registry);
    }

    pub fn get_moderation_registry(env: Env) -> Result<Address, QuidError> {
        Self::moderation_registry(&env).ok_or(QuidError::ModerationRegistryNotSet)
    }

    fn moderation_registry(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ModerationRegistry)
    }

    /// Set the protocol treasury address. Must be called by the treasury itself.
    pub fn set_treasury(env: Env, new_treasury: Address) {
        // If a treasury is already set, only the current treasury may update it.
        if let Some(current_treasury) = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::Treasury)
        {
            current_treasury.require_auth();
        } else {
            // Initial set: require authorization from the new treasury address.
            new_treasury.require_auth();
        }

        env.storage()
            .instance()
            .set(&DataKey::Treasury, &new_treasury);
    }

    /// Point the store at a `quid-fee-collector` vault.
    ///
    /// Follows the same handover rule as `set_treasury`: the first caller to
    /// claim the slot must authorize as the new collector, and afterwards only
    /// the current collector can move it.
    pub fn set_fee_collector(env: Env, new_collector: Address) {
        if let Some(current) = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::FeeCollector)
        {
            current.require_auth();
        } else {
            new_collector.require_auth();
        }

        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &new_collector);
    }

    /// Get the configured protocol fee vault.
    pub fn get_fee_collector(env: Env) -> Result<Address, QuidError> {
        env.storage()
            .instance()
            .get(&DataKey::FeeCollector)
            .ok_or(QuidError::FeeCollectorNotSet)
    }

    /// Point the store at a `quid-reputation` registry so a settled payout
    /// issues a `quid-payout` attestation for the hunter.
    ///
    /// Same handover rule as `set_treasury` / `set_fee_collector`: the first
    /// caller to claim the slot must authorize as the new registry, and after
    /// that only the current registry can move it.
    pub fn set_reputation_contract(env: Env, new_reputation: Address) {
        if let Some(current) = Self::reputation_contract(&env) {
            current.require_auth();
        } else {
            new_reputation.require_auth();
        }

        env.storage()
            .instance()
            .set(&DataKey::ReputationContract, &new_reputation);
    }

    /// Get the configured reputation registry.
    pub fn get_reputation_contract(env: Env) -> Result<Address, QuidError> {
        Self::reputation_contract(&env).ok_or(QuidError::ReputationNotSet)
    }

    fn reputation_contract(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ReputationContract)
    }

    /// Issue a payout attestation for `hunter` against `data_cid`.
    ///
    /// No-op when no registry is configured — that is the whole point of the
    /// wiring being opt-in.
    fn attest_payout(
        env: &Env,
        mission_id: u64,
        hunter: &Address,
        data_cid: &String,
    ) -> Result<(), QuidError> {
        let Some(reputation) = Self::reputation_contract(env) else {
            return Ok(());
        };

        let store = env.current_contract_address();
        let attestation_type = String::from_str(env, PAYOUT_ATTESTATION_TYPE);
        let subject = hunter.clone();
        let payload = data_cid.clone();

        // The registry asks the *issuer* (this store) to authorize the call,
        // and a contract's implicit auth only covers its own direct sub-call,
        // so pre-authorize the nested invocation explicitly.
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: reputation.clone(),
                    fn_name: Symbol::new(env, "issue_attestation"),
                    args: (
                        store.clone(),
                        subject.clone(),
                        attestation_type.clone(),
                        payload.clone(),
                    )
                        .into_val(env),
                },
                sub_invocations: vec![env],
            }),
        ]);

        let attestation_id = ReputationRegistryClient::new(env, &reputation).issue_attestation(
            &store,
            &subject,
            &attestation_type,
            &payload,
        );

        PayoutAttestedEvent {
            mission_id,
            attestation_id,
        }
        .publish(env);

        Ok(())
    }

    /// Protocol fee owed on `gross_amount`, or zero when no vault is configured.
    ///
    /// Missions created before a collector is set stay fee-free, so wiring the
    /// vault up is a non-breaking change for existing deployments.
    fn quote_protocol_fee(
        env: &Env,
        token: &Address,
        gross_amount: i128,
    ) -> Result<i128, QuidError> {
        let Some(collector) = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::FeeCollector)
        else {
            return Ok(0);
        };

        let fee = FeeCollectorClient::new(env, &collector).compute_fee_for(token, &gross_amount);
        if fee < 0 || fee > gross_amount {
            return Err(QuidError::InvalidAmount);
        }

        Ok(fee)
    }

    /// Hand `fee` (already escrowed here) over to the fee vault.
    ///
    /// The vault pulls the tokens itself, which happens one frame below this
    /// call, so the store has to pre-authorize that nested transfer on its own
    /// behalf — a contract's implicit auth only covers its direct sub-call.
    fn forward_fee(env: &Env, collector: &Address, token: &Address, fee: i128) {
        let store = env.current_contract_address();

        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: token.clone(),
                    fn_name: Symbol::new(env, "transfer"),
                    args: (store.clone(), collector.clone(), fee).into_val(env),
                },
                sub_invocations: vec![env],
            }),
        ]);

        FeeCollectorClient::new(env, collector).deposit_fee(&store, token, &fee);
    }

    /// Get the protocol treasury address.
    pub fn get_treasury(env: Env) -> Result<Address, QuidError> {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .ok_or(QuidError::TreasuryNotSet)
    }

    /// Slash a hunter's stake by sending it to the protocol treasury.
    fn slash_stake(
        env: &Env,
        mission_id: u64,
        hunter: Address,
        stake_token: Address,
    ) -> Result<(), QuidError> {
        let key = DataKey::HunterStake(mission_id, hunter.clone());

        let amount: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuidError::StakeNotFound)?;

        if let Some(pool) = Self::staking_pool(env) {
            StakingPoolClient::new(env, &pool).slash_for_mission(
                &env.current_contract_address(),
                &mission_id,
                &hunter,
                &stake_token,
            );
            env.storage().persistent().remove(&key);
            return Ok(());
        }

        let treasury = Self::get_treasury(env.clone())?;

        token::Client::new(env, &stake_token).transfer(
            &env.current_contract_address(),
            &treasury,
            &amount,
        );

        env.storage().persistent().remove(&key);

        Ok(())
    }

    /// Release a stake lock back to the hunter's available pool balance.
    ///
    /// Returns the amount that was unlocked so callers can report it in an
    /// event. Missing or already-released stakes refund zero.
    fn release_stake(env: &Env, mission_id: u64, hunter: Address, stake_token: Address) -> i128 {
        let key = DataKey::HunterStake(mission_id, hunter.clone());

        if env.storage().persistent().has(&key) {
            if let Some(pool) = Self::staking_pool(env) {
                StakingPoolClient::new(env, &pool).unlock_for_mission(
                    &env.current_contract_address(),
                    &mission_id,
                    &hunter,
                    &stake_token,
                );
                let unlocked: i128 = env.storage().persistent().get(&key).unwrap_or(0);
                env.storage().persistent().remove(&key);
                return unlocked;
            }
        }

        if let Some(amount) = env.storage().persistent().get::<DataKey, i128>(&key) {
            token::Client::new(env, &stake_token).transfer(
                &env.current_contract_address(),
                &hunter,
                &amount,
            );

            env.storage().persistent().remove(&key);

            return amount;
        }

        0
    }
}
mod test;

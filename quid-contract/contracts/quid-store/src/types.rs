use soroban_sdk::{contracttype, Address, String, Vec};

#[derive(Clone, Debug, Default, PartialEq, Eq, Copy)]
#[contracttype]
pub enum MissionStatus {
    #[default]
    Created,
    Open,
    Started,
    Paused,
    Completed,
    Cancelled,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Copy)]
#[contracttype]
pub enum SubmissionStatus {
    #[default]
    Pending,
    Approved,
    Paid,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Mission {
    pub id: u64,
    pub owner: Address,
    pub title: String,
    pub description_cid: String,
    pub reward_token: Address,
    pub reward_amount: i128,
    pub max_participants: u32,
    pub participants_count: u32,
    pub status: MissionStatus,
    pub created_at: u64,
    pub min_asset: Option<Address>,
    pub min_asset_amount: i128,
    /// Unix timestamp after which no new submission is accepted and the
    /// unused escrow can be reclaimed through `expire_mission`.
    ///
    /// `None` means the mission never expires, which is what every mission
    /// created before this field existed behaves like.
    pub expires_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Submission {
    pub hunter: Address,
    pub ipfs_cid: String,
    pub status: SubmissionStatus,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeTiers {
    /// Inclusive minimum reputation scores for each tier (ascending).
    pub thresholds: Vec<u32>,
    /// Stake multiplier in basis points for each tier (descending recommended).
    pub bps: Vec<u32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TestRequirement {
    /// Proof registry contract address.
    pub registry: Address,
}

#[contracttype]
pub enum DataKey {
    Mission(u64),
    MissionCount,
    Submission(u64, Address),
    HunterStake(u64, Address),
    Treasury,
    /// Optional reusable hunter stake pool.
    StakingPool,
    /// Optional protocol fee vault (`quid-fee-collector`) charged on mission create.
    FeeCollector,
    /// Optional `quid-moderation-registry` consulted by `submit_feedback` (#305).
    ModerationRegistry,
    /// Optional reputation registry (`quid-reputation`) attested on payout.
    ReputationContract,
    /// Optional proof registry for Proof-of-Test gating (SC-012).
    ProofRegistry,
    /// Per-mission test requirement pointing at a proof registry.
    MissionTestRequirement(u64),
    /// Per-mission stake tier configuration (SC-022).
    MissionStakeTiers(u64),
    /// Base stake amount configured for a mission (optional).
    MissionBaseStake(u64),
    /// Number of missions created by an owner (SC-009).
    OwnerMissionCount(Address),
    /// 0-indexed mission id for a given owner at index u32 (SC-009).
    OwnerMissionAt(Address, u32),
}

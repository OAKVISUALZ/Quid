use soroban_sdk::{contracttype, Address, String, Symbol, Vec};

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
pub struct TestRequirement {
    pub target_contract: Address,
    pub functions: Vec<Symbol>,
    pub network: Symbol,
    pub window_start: u64,
    pub window_end: u64,
    pub proof_registry: Address,
}

#[contracttype]
pub enum DataKey {
    Mission(u64),
    MissionCount,
    Submission(u64, Address),
    SubmissionCount(u64),
    Requirement(u64),
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
}

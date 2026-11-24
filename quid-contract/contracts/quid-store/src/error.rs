use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum QuidError {
    MissionNotFound = 1,
    MissionClosed = 2,
    MissionFull = 3,
    AlreadySubmitted = 4,
    InsufficientFunds = 5,
    NotAuthorized = 6,
    NegativeReward = 7,
    InvalidState = 8,
    AlreadyPaid = 9,
    MissionNotOpen = 10,
    SubmissionNotFound = 11,
    NotPending = 12,
    InvalidAmount = 13,
    TreasuryNotSet = 14,
    StakeNotFound = 15,
    InsufficientAssetBalance = 16,
    FeeCollectorNotSet = 17,
    StakingPoolNotSet = 18,
    /// Hunter is banned or muted in the configured moderation registry (#305).
    HunterBanned = 19,
    /// No moderation registry has been configured.
    ModerationRegistryNotSet = 20,
    AlreadyRejected = 21,
    /// `expires_at` is at or before the current ledger timestamp.
    ExpiryInThePast = 22,
    /// The mission's deadline has passed: no new submissions are accepted.
    MissionExpired = 23,
    /// `expire_mission` was called before the mission's deadline.
    MissionNotExpired = 24,
    ReputationNotSet = 25,
    /// The requirement is malformed (empty/too many functions or bad window).
    InvalidRequirement = 26,
    /// A requirement cannot be changed after the first submission.
    RequirementLocked = 27,
}

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ProofError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    NotVerifier = 4,
    AlreadyAttested = 5,
    ProofNotFound = 6,
    InvalidSignature = 7,
    AttestationExpired = 8,
    Replay = 9,
    ThresholdTooHigh = 10,
    InvalidThreshold = 11,
    ProbeInteractionNotFound = 12,
}

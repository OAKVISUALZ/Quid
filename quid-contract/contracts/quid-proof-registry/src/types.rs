use soroban_sdk::{contracttype, Address, BytesN, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
pub enum ProofSource {
    Verifier,
    Signed,
    Probe,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofRecord {
    pub mission_id: u64,
    pub hunter: Address,
    pub tx_hash: BytesN<32>,
    pub data_cid: String,
    pub attestation_count: u32,
    pub valid: bool,
    pub source: ProofSource,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignedPayload {
    pub contract: Address,
    pub mission_id: u64,
    pub hunter: Address,
    pub tx_hash: BytesN<32>,
    pub data_cid: String,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Verifier(Address),
    VerifierKey(Address),
    Proof(u64, Address, BytesN<32>),
    Attestations(u64, Address, BytesN<32>),
    Threshold(u64),
    /// True once attestation count meets threshold for (mission, hunter).
    ValidProof(u64, Address),
    StoreContract,
    MissionProbe(u64),
}

pub const TTL_THRESHOLD: u32 = 100_000;
pub const TTL_EXTEND_TO: u32 = 500_000;

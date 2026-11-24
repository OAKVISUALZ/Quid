#![no_std]
// `submit_signed_proof` takes one argument per signed-proof field (hunter,
// mission, tx hash, data CID, verifier, signature, expiry). The
// `#[contractimpl]` macro emits the matching client and trait methods at the
// same span, so the allowance has to live at crate level to cover them.
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contractclient, contractimpl, xdr::ToXdr, Address, Bytes, BytesN, Env, String,
    Symbol, Vec,
};

mod error;
mod types;

#[cfg(test)]
mod test;

pub use error::ProofError;
pub use types::*;

#[contractclient(name = "StoreClient")]
pub trait Store {
    fn get_mission_owner(env: Env, mission_id: u64) -> Address;
}

#[contractclient(name = "ProbeClient")]
pub trait Probe {
    fn has_interaction(env: Env, mission_id: u64, hunter: Address, function: Symbol) -> bool;
}

fn extend(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Canonical message bytes for ed25519 verification (SC-013).
/// Spec: XDR of SignedPayload via to_xdr — backends must match this encoding.
pub fn payload_message(env: &Env, payload: &SignedPayload) -> Bytes {
    payload.to_xdr(env)
}

#[contract]
pub struct QuidProofRegistry;

#[contractimpl]
impl QuidProofRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ProofError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ProofError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn set_store(env: Env, store: Address) -> Result<(), ProofError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ProofError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::StoreContract, &store);
        Ok(())
    }

    pub fn set_mission_probe(
        env: Env,
        caller: Address,
        mission_id: u64,
        probe: Address,
    ) -> Result<(), ProofError> {
        caller.require_auth();
        let store = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::StoreContract)
            .ok_or(ProofError::NotInitialized)?;
        if caller != StoreClient::new(&env, &store).get_mission_owner(&mission_id) {
            return Err(ProofError::NotAuthorized);
        }
        let key = DataKey::MissionProbe(mission_id);
        env.storage().persistent().set(&key, &probe);
        extend(&env, &key);
        Ok(())
    }

    pub fn register_verifier(
        env: Env,
        verifier: Address,
        ed25519_key: BytesN<32>,
    ) -> Result<(), ProofError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ProofError::NotInitialized)?;
        admin.require_auth();
        let vkey = DataKey::Verifier(verifier.clone());
        env.storage().persistent().set(&vkey, &true);
        extend(&env, &vkey);
        let kkey = DataKey::VerifierKey(verifier);
        env.storage().persistent().set(&kkey, &ed25519_key);
        extend(&env, &kkey);
        Ok(())
    }

    pub fn remove_verifier(env: Env, verifier: Address) -> Result<(), ProofError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ProofError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Verifier(verifier));
        // Removing a verifier does not invalidate past attestations.
        Ok(())
    }

    pub fn set_mission_threshold(
        env: Env,
        caller: Address,
        mission_id: u64,
        threshold: u32,
    ) -> Result<(), ProofError> {
        caller.require_auth();
        if threshold == 0 {
            return Err(ProofError::InvalidThreshold);
        }
        if let Some(store) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::StoreContract)
        {
            let owner = StoreClient::new(&env, &store).get_mission_owner(&mission_id);
            if caller != owner {
                return Err(ProofError::NotAuthorized);
            }
        } else {
            let admin: Address = env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .ok_or(ProofError::NotInitialized)?;
            if caller != admin {
                return Err(ProofError::NotAuthorized);
            }
        }
        let key = DataKey::Threshold(mission_id);
        env.storage().persistent().set(&key, &threshold);
        extend(&env, &key);
        Ok(())
    }

    pub fn get_mission_threshold(env: Env, mission_id: u64) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Threshold(mission_id))
            .unwrap_or(1)
    }

    pub fn record_proof(
        env: Env,
        verifier: Address,
        mission_id: u64,
        hunter: Address,
        tx_hash: BytesN<32>,
        data_cid: String,
    ) -> Result<(), ProofError> {
        verifier.require_auth();
        Self::assert_verifier(&env, &verifier)?;
        Self::add_attestation(
            &env,
            mission_id,
            &hunter,
            &tx_hash,
            &data_cid,
            &verifier,
            ProofSource::Verifier,
        )
    }

    pub fn submit_signed_proof(
        env: Env,
        hunter: Address,
        mission_id: u64,
        tx_hash: BytesN<32>,
        data_cid: String,
        verifier: Address,
        signature: BytesN<64>,
        expires_at: u64,
    ) -> Result<(), ProofError> {
        hunter.require_auth();
        if env.ledger().timestamp() > expires_at {
            return Err(ProofError::AttestationExpired);
        }
        Self::assert_verifier(&env, &verifier)?;
        let key: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::VerifierKey(verifier.clone()))
            .ok_or(ProofError::NotVerifier)?;

        let payload = SignedPayload {
            contract: env.current_contract_address(),
            mission_id,
            hunter: hunter.clone(),
            tx_hash: tx_hash.clone(),
            data_cid: data_cid.clone(),
            expires_at,
        };
        let msg = payload_message(&env, &payload);
        env.crypto().ed25519_verify(&key, &msg, &signature);
        Self::add_attestation(
            &env,
            mission_id,
            &hunter,
            &tx_hash,
            &data_cid,
            &verifier,
            ProofSource::Signed,
        )
    }

    pub fn claim_probe_proof(
        env: Env,
        mission_id: u64,
        hunter: Address,
        function: Symbol,
    ) -> Result<(), ProofError> {
        hunter.require_auth();
        let probe: Address = env
            .storage()
            .persistent()
            .get(&DataKey::MissionProbe(mission_id))
            .ok_or(ProofError::ProbeInteractionNotFound)?;
        if !ProbeClient::new(&env, &probe).has_interaction(&mission_id, &hunter, &function) {
            return Err(ProofError::ProbeInteractionNotFound);
        }
        let tx_hash = BytesN::from_array(&env, &[0; 32]);
        Self::add_attestation(
            &env,
            mission_id,
            &hunter,
            &tx_hash,
            &String::from_str(&env, "probe"),
            &probe,
            ProofSource::Probe,
        )
    }

    pub fn has_valid_proof(env: Env, mission_id: u64, hunter: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::ValidProof(mission_id, hunter))
            .unwrap_or(false)
    }

    fn assert_verifier(env: &Env, verifier: &Address) -> Result<(), ProofError> {
        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Verifier(verifier.clone()))
            .unwrap_or(false)
        {
            Ok(())
        } else {
            Err(ProofError::NotVerifier)
        }
    }

    fn add_attestation(
        env: &Env,
        mission_id: u64,
        hunter: &Address,
        tx_hash: &BytesN<32>,
        data_cid: &String,
        verifier: &Address,
        source: ProofSource,
    ) -> Result<(), ProofError> {
        let pkey = DataKey::Proof(mission_id, hunter.clone(), tx_hash.clone());
        let akey = DataKey::Attestations(mission_id, hunter.clone(), tx_hash.clone());

        let mut attesters: Vec<Address> = env
            .storage()
            .persistent()
            .get(&akey)
            .unwrap_or_else(|| Vec::new(env));

        for i in 0..attesters.len() {
            if attesters.get(i).unwrap() == *verifier {
                return Err(ProofError::AlreadyAttested);
            }
        }
        attesters.push_back(verifier.clone());
        env.storage().persistent().set(&akey, &attesters);
        extend(env, &akey);

        let threshold = Self::get_mission_threshold(env.clone(), mission_id);
        let count = attesters.len();
        let valid = count >= threshold;

        let record = ProofRecord {
            mission_id,
            hunter: hunter.clone(),
            tx_hash: tx_hash.clone(),
            data_cid: data_cid.clone(),
            attestation_count: count,
            valid,
            source,
        };
        env.storage().persistent().set(&pkey, &record);
        extend(env, &pkey);

        if valid {
            let vkey = DataKey::ValidProof(mission_id, hunter.clone());
            env.storage().persistent().set(&vkey, &true);
            extend(env, &vkey);
        }
        Ok(())
    }
}

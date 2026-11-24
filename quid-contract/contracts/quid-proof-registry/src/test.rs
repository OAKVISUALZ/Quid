use crate::{ProofError, QuidProofRegistry, QuidProofRegistryClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String,
};

fn setup() -> (Env, QuidProofRegistryClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(QuidProofRegistry, ());
    let client = QuidProofRegistryClient::new(&env, &id);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn threshold_default_one_attestation_validates() {
    let (env, client, _admin) = setup();
    let v = Address::generate(&env);
    let hunter = Address::generate(&env);
    let key = BytesN::from_array(&env, &[1u8; 32]);
    client.register_verifier(&v, &key);
    let tx = BytesN::from_array(&env, &[2u8; 32]);
    client.record_proof(&v, &1u64, &hunter, &tx, &String::from_str(&env, "cid"));
    assert!(client.has_valid_proof(&1u64, &hunter));
}

#[test]
fn multi_verifier_two_of_two() {
    let (env, client, admin) = setup();
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let hunter = Address::generate(&env);
    client.register_verifier(&v1, &BytesN::from_array(&env, &[1u8; 32]));
    client.register_verifier(&v2, &BytesN::from_array(&env, &[2u8; 32]));
    client.set_mission_threshold(&admin, &7u64, &2u32);
    let tx = BytesN::from_array(&env, &[9u8; 32]);
    client.record_proof(&v1, &7u64, &hunter, &tx, &String::from_str(&env, "c"));
    assert!(!client.has_valid_proof(&7u64, &hunter));
    client.record_proof(&v2, &7u64, &hunter, &tx, &String::from_str(&env, "c"));
    assert!(client.has_valid_proof(&7u64, &hunter));
}

#[test]
fn duplicate_attestation_fails() {
    let (env, client, admin) = setup();
    let v = Address::generate(&env);
    let hunter = Address::generate(&env);
    client.register_verifier(&v, &BytesN::from_array(&env, &[1u8; 32]));
    client.set_mission_threshold(&admin, &3u64, &2u32);
    let tx = BytesN::from_array(&env, &[3u8; 32]);
    client.record_proof(&v, &3u64, &hunter, &tx, &String::from_str(&env, "c"));
    let err = client.try_record_proof(&v, &3u64, &hunter, &tx, &String::from_str(&env, "c"));
    assert_eq!(err, Err(Ok(ProofError::AlreadyAttested)));
}

#[test]
fn expired_signed_proof_rejected() {
    let (env, client, _admin) = setup();
    let v = Address::generate(&env);
    let hunter = Address::generate(&env);
    client.register_verifier(&v, &BytesN::from_array(&env, &[1u8; 32]));
    env.ledger().with_mut(|l| l.timestamp = 1_000);
    let tx = BytesN::from_array(&env, &[4u8; 32]);
    let sig = BytesN::from_array(&env, &[0u8; 64]);
    let err = client.try_submit_signed_proof(
        &hunter,
        &1u64,
        &tx,
        &String::from_str(&env, "c"),
        &v,
        &sig,
        &500u64,
    );
    assert_eq!(err, Err(Ok(ProofError::AttestationExpired)));
}

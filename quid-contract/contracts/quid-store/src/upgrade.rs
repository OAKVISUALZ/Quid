//! Admin-gated WASM upgrade with contract version tracking.
//!
//! # Storage key
//! [`DataKey::Version`] — a `u32` stored in **instance** storage and extended
//! alongside the instance TTL so it can never expire while the contract is
//! alive.
//!
//! # Upgrade flow
//! 1. Compile the fixed contract and upload it with `stellar contract upload`.
//! 2. Note the new 32-byte wasm hash printed by the upload command.
//! 3. Call `upgrade(new_wasm_hash)` as the admin.  The call atomically:
//!    a. verifies admin auth,
//!    b. swaps the running wasm,
//!    c. bumps the version counter,
//!    d. emits an `Upgraded` event.
//! 4. Confirm with `version()` and by re-reading a mission that was created
//!    before the upgrade.

use soroban_sdk::{BytesN, Env};

use crate::types::DataKey;
use crate::QuidError;

/// Default starting version for a freshly deployed contract.
pub(crate) const INITIAL_VERSION: u32 = 1;

/// Bump the WASM to `new_wasm_hash` and increment the version counter.
///
/// **Caller is responsible for `require_auth` on the admin before calling
/// this.**  The function intentionally does not look up the admin itself so
/// the admin-resolution logic stays in one place inside `lib.rs`.
pub(crate) fn upgrade_to(
    env: &Env,
    new_wasm_hash: BytesN<32>,
) -> Result<(u32, u32), QuidError> {
    let old_version: u32 = env
        .storage()
        .instance()
        .get(&DataKey::Version)
        .unwrap_or(INITIAL_VERSION);

    let new_version = old_version.checked_add(1).ok_or(QuidError::Overflow)?;

    // Swap the wasm – after this instruction the new code is active.
    env.deployer()
        .update_current_contract_wasm(new_wasm_hash);

    // Persist the bumped version and keep it alive.
    env.storage()
        .instance()
        .set(&DataKey::Version, &new_version);

    Ok((old_version, new_version))
}

/// Read the current version from storage, defaulting to [`INITIAL_VERSION`]
/// for contracts that have never been upgraded.
pub(crate) fn current_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::Version)
        .unwrap_or(INITIAL_VERSION)
}

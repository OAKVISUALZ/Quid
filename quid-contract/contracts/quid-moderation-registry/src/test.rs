use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};

fn setup() -> (Env, QuidModerationRegistryContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(QuidModerationRegistryContract, ());
    let client = QuidModerationRegistryContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

fn with_moderator() -> (
    Env,
    QuidModerationRegistryContractClient<'static>,
    Address,
    Address,
) {
    let (env, client, admin) = setup();
    let moderator = Address::generate(&env);
    client.set_moderator(&moderator, &true);
    (env, client, admin, moderator)
}

// ── Initialization & roles ────────────────────────────────────────────────────

#[test]
fn initialize_sets_admin_once() {
    let (env, client, admin) = setup();
    assert_eq!(client.get_admin(), admin);
    assert_eq!(
        client.try_initialize(&Address::generate(&env)),
        Err(Ok(ModerationError::AlreadyInitialized))
    );
}

#[test]
fn get_admin_before_initialize_fails() {
    let env = Env::default();
    let id = env.register(QuidModerationRegistryContract, ());
    let client = QuidModerationRegistryContractClient::new(&env, &id);
    assert_eq!(
        client.try_get_admin(),
        Err(Ok(ModerationError::NotInitialized))
    );
}

#[test]
fn admin_grants_and_revokes_moderators() {
    let (env, client, admin) = setup();
    let moderator = Address::generate(&env);

    assert!(client.is_moderator(&admin));
    assert!(!client.is_moderator(&moderator));

    client.set_moderator(&moderator, &true);
    assert!(client.is_moderator(&moderator));

    client.set_moderator(&moderator, &false);
    assert!(!client.is_moderator(&moderator));
}

#[test]
fn set_moderator_requires_admin_auth() {
    let (env, client, admin) = setup();
    let moderator = Address::generate(&env);
    client.set_moderator(&moderator, &true);

    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, admin);
}

// ── Only moderators can ban ───────────────────────────────────────────────────

#[test]
fn moderator_bans_and_unbans() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);

    assert!(client.can_submit(&hunter));

    client.ban(&moderator, &hunter);
    assert!(client.is_banned(&hunter));
    assert!(!client.can_submit(&hunter));
    let record = client.get_ban(&hunter).unwrap();
    assert_eq!(record.moderator, moderator);

    client.unban(&moderator, &hunter);
    assert!(!client.is_banned(&hunter));
    assert!(client.can_submit(&hunter));
    assert_eq!(client.get_ban(&hunter), None);
}

#[test]
fn admin_can_ban_without_being_granted_the_role() {
    let (env, client, admin) = setup();
    let hunter = Address::generate(&env);
    client.ban(&admin, &hunter);
    assert!(client.is_banned(&hunter));
}

#[test]
fn non_moderator_cannot_ban_unban_mute_or_unmute() {
    let (env, client, _, moderator) = with_moderator();
    let outsider = Address::generate(&env);
    let hunter = Address::generate(&env);

    assert_eq!(
        client.try_ban(&outsider, &hunter),
        Err(Ok(ModerationError::NotModerator))
    );
    assert!(!client.is_banned(&hunter));

    client.ban(&moderator, &hunter);
    assert_eq!(
        client.try_unban(&outsider, &hunter),
        Err(Ok(ModerationError::NotModerator))
    );
    assert!(client.is_banned(&hunter));

    assert_eq!(
        client.try_mute(&outsider, &hunter, &100),
        Err(Ok(ModerationError::NotModerator))
    );
    client.mute(&moderator, &hunter, &100);
    assert_eq!(
        client.try_unmute(&outsider, &hunter),
        Err(Ok(ModerationError::NotModerator))
    );
}

#[test]
fn revoked_moderator_loses_ban_rights_immediately() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);

    client.set_moderator(&moderator, &false);
    assert_eq!(
        client.try_ban(&moderator, &hunter),
        Err(Ok(ModerationError::NotModerator))
    );
}

#[test]
fn ban_requires_the_moderators_own_auth() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);
    client.ban(&moderator, &hunter);

    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, moderator);
}

#[test]
#[should_panic]
fn ban_without_any_auth_panics() {
    let env = Env::default();
    let id = env.register(QuidModerationRegistryContract, ());
    let client = QuidModerationRegistryContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin);

    // Drop mocked auths: the admin's signature is now missing.
    env.set_auths(&[]);
    client.ban(&admin, &Address::generate(&env));
}

#[test]
fn duplicate_ban_and_unban_are_rejected() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);

    assert_eq!(
        client.try_unban(&moderator, &hunter),
        Err(Ok(ModerationError::NotBanned))
    );
    client.ban(&moderator, &hunter);
    assert_eq!(
        client.try_ban(&moderator, &hunter),
        Err(Ok(ModerationError::AlreadyBanned))
    );
}

#[test]
fn admin_cannot_be_banned_or_muted() {
    let (_, client, admin, moderator) = with_moderator();
    assert_eq!(
        client.try_ban(&moderator, &admin),
        Err(Ok(ModerationError::CannotModerateAdmin))
    );
    assert_eq!(
        client.try_mute(&moderator, &admin, &100),
        Err(Ok(ModerationError::CannotModerateAdmin))
    );
    assert!(client.can_submit(&admin));
}

// ── Mutes ─────────────────────────────────────────────────────────────────────

#[test]
fn mute_expires_exactly_at_until() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);
    env.ledger().set_timestamp(1_000);

    client.mute(&moderator, &hunter, &1_100);
    assert!(client.is_muted(&hunter));
    assert!(!client.can_submit(&hunter));

    env.ledger().set_timestamp(1_099);
    assert!(client.is_muted(&hunter));

    env.ledger().set_timestamp(1_100);
    assert!(!client.is_muted(&hunter));
    assert!(client.can_submit(&hunter));
}

#[test]
fn mute_expiry_must_be_in_the_future() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);
    env.ledger().set_timestamp(500);

    assert_eq!(
        client.try_mute(&moderator, &hunter, &500),
        Err(Ok(ModerationError::InvalidMuteExpiry))
    );
    assert_eq!(
        client.try_mute(&moderator, &hunter, &499),
        Err(Ok(ModerationError::InvalidMuteExpiry))
    );
    client.mute(&moderator, &hunter, &501);
    assert!(client.is_muted(&hunter));
}

#[test]
fn remute_replaces_expiry_and_unmute_lifts_it() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);
    env.ledger().set_timestamp(10);

    client.mute(&moderator, &hunter, &20);
    client.mute(&moderator, &hunter, &50);
    assert_eq!(client.get_mute(&hunter).unwrap().until, 50);

    client.unmute(&moderator, &hunter);
    assert!(!client.is_muted(&hunter));
    assert_eq!(
        client.try_unmute(&moderator, &hunter),
        Err(Ok(ModerationError::NotMuted))
    );
}

#[test]
fn ban_and_mute_are_independent() {
    let (env, client, _, moderator) = with_moderator();
    let hunter = Address::generate(&env);
    env.ledger().set_timestamp(10);

    client.ban(&moderator, &hunter);
    client.mute(&moderator, &hunter, &100);

    client.unmute(&moderator, &hunter);
    assert!(!client.can_submit(&hunter), "still banned");

    client.unban(&moderator, &hunter);
    assert!(client.can_submit(&hunter));
}

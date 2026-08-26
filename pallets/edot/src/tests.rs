use crate::{mock::*, Error, Event, Shares, TotalAssets, TotalShares, TotalSlashed};
use frame::testing_prelude::*;
use polkadot_sdk::pallet_balances::Pallet as BalancesPallet;

fn vault_free() -> u128 {
	Balances::free_balance(Edot::account_id())
}

#[test]
fn genesis_seeds_dead_shares() {
	new_test_ext().execute_with(|| {
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get());
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(TotalSlashed::<Test>::get(), 0);
		assert_eq!(vault_free(), DeadShares::get());
	});
}

#[test]
fn deposit_mints_one_to_one_at_genesis_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 100);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(vault_free(), DeadShares::get() + 100);
		System::assert_last_event(
			Event::Deposited { who: ALICE, assets: 100, shares: 100 }.into(),
		);
	});
}

#[test]
fn rewards_raise_rate_without_minting_shares() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let shares_before = Shares::<Test>::get(ALICE);
		assert_ok!(Edot::accrue_rewards(RuntimeOrigin::root(), 100));
		assert_eq!(Shares::<Test>::get(ALICE), shares_before);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 200);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(vault_free(), DeadShares::get() + 200);
		// 100 shares redeem for floor(100 * V / S) = floor(100 * 1200 / 1100) = 109
		assert_eq!(Edot::convert_to_assets(100).unwrap(), 109);
	});
}

#[test]
fn slash_lowers_rate_without_burning_shares() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let shares_before = Shares::<Test>::get(ALICE);
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 40));
		assert_eq!(Shares::<Test>::get(ALICE), shares_before);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 60);
		assert_eq!(TotalSlashed::<Test>::get(), 40);
		assert_eq!(vault_free(), DeadShares::get() + 60);
		// 100 shares redeem for floor(100 * 1060 / 1100) = 96
		assert_eq!(Edot::convert_to_assets(100).unwrap(), 96);
		System::assert_last_event(
			Event::Slashed { amount: 40, total_assets: DeadShares::get() + 60 }.into(),
		);
	});
}

#[test]
fn slash_caps_at_real_assets_preserving_dead_floor() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 10_000));
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get());
		assert_eq!(TotalSlashed::<Test>::get(), 100);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(vault_free(), DeadShares::get());
		assert_eq!(Edot::convert_to_assets(100).unwrap(), 90);
	});
}

#[test]
fn redeem_after_slash_returns_impaired_assets() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 40));
		let alice_bal_before = Balances::free_balance(ALICE);
		assert_ok!(Edot::redeem(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(Balances::free_balance(ALICE) - alice_bal_before, 96);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		// After slash V=1060; redeem pays floor(100*1060/1100)=96 → V=964.
		assert_eq!(TotalAssets::<Test>::get(), 964);
		assert_eq!(vault_free(), 964);
	});
}

#[test]
fn second_depositor_gets_more_shares_after_slash() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 40));
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(BOB), 100));
		// Bob: floor(100 * 1100 / 1060) = 103
		assert_eq!(Shares::<Test>::get(BOB), 103);
		assert!(Shares::<Test>::get(BOB) > Shares::<Test>::get(ALICE));
	});
}

#[test]
fn deposit_below_minimum_fails() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			Edot::deposit(RuntimeOrigin::signed(ALICE), 1),
			Error::<Test>::DepositTooSmall
		);
	});
}

#[test]
fn redeem_more_than_balance_fails() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_noop!(
			Edot::redeem(RuntimeOrigin::signed(ALICE), 101),
			Error::<Test>::InsufficientShares
		);
	});
}

#[test]
fn zero_redeem_fails() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_noop!(
			Edot::redeem(RuntimeOrigin::signed(ALICE), 0),
			Error::<Test>::ZeroSharesRedeem
		);
	});
}

#[test]
fn zero_slash_fails() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_noop!(Edot::apply_slash(RuntimeOrigin::root(), 0), Error::<Test>::ZeroSlash);
	});
}

#[test]
fn non_admin_cannot_slash_or_accrue() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			Edot::accrue_rewards(RuntimeOrigin::signed(ALICE), 10),
			DispatchError::BadOrigin
		);
		assert_noop!(
			Edot::apply_slash(RuntimeOrigin::signed(ALICE), 10),
			DispatchError::BadOrigin
		);
	});
}

#[test]
fn slash_with_only_dead_assets_fails() {
	new_test_ext().execute_with(|| {
		assert_noop!(Edot::apply_slash(RuntimeOrigin::root(), 1), Error::<Test>::NothingToSlash);
	});
}

#[test]
fn partial_redeem_leaves_remaining_shares() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let before = Balances::free_balance(ALICE);
		assert_ok!(Edot::redeem(RuntimeOrigin::signed(ALICE), 40));
		assert_eq!(Shares::<Test>::get(ALICE), 60);
		assert_eq!(Balances::free_balance(ALICE) - before, 40);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 60);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 60);
		assert_eq!(vault_free(), DeadShares::get() + 60);
	});
}

#[test]
fn slash_socializes_loss_across_two_holders() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(BOB), 100));
		// V=1200, S=1200; slash 60 → V=1140
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 60));
		assert_eq!(Shares::<Test>::get(ALICE), 100);
		assert_eq!(Shares::<Test>::get(BOB), 100);
		// Each 100 shares → floor(100 * 1140 / 1200) = 95
		assert_eq!(Edot::convert_to_assets(100).unwrap(), 95);
		assert_eq!(TotalSlashed::<Test>::get(), 60);
	});
}

#[test]
fn accrue_then_slash_nets_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::accrue_rewards(RuntimeOrigin::root(), 50));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 20));
		// V = 1000 + 100 + 50 - 20 = 1130; S = 1100
		assert_eq!(TotalAssets::<Test>::get(), 1130);
		assert_eq!(Edot::convert_to_assets(100).unwrap(), 102); // floor(100*1130/1100)
		assert_eq!(vault_free(), 1130);
	});
}

#[test]
fn sequential_slashes_accumulate_total_slashed() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 10));
		assert_ok!(Edot::apply_slash(RuntimeOrigin::root(), 15));
		assert_eq!(TotalSlashed::<Test>::get(), 25);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 75);
	});
}

#[test]
fn donation_to_vault_does_not_inflate_mint_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		// Attacker donates 500 directly into the vault without minting shares.
		assert_ok!(BalancesPallet::<Test>::transfer_allow_death(
			RuntimeOrigin::signed(BOB),
			Edot::account_id(),
			500,
		));
		// Stored V is unchanged (still 1100); donation sits as surplus in the vault.
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 100);
		assert!(vault_free() > TotalAssets::<Test>::get());
		// Later deposit still mints at V/S, not at inflated vault balance.
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(BOB), 100));
		assert_eq!(Shares::<Test>::get(BOB), 100);
	});
}

/// Documents Phase C gap: instant redeem before apply_slash exits at pre-slash NAV
/// and can leave nothing slashable (§10.1A socialization needs Phase D ordering).
#[test]
fn redeem_before_slash_exits_at_full_nav() {
	new_test_ext().execute_with(|| {
		assert_ok!(Edot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let before = Balances::free_balance(ALICE);
		assert_ok!(Edot::redeem(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Balances::free_balance(ALICE) - before, 100);
		// Only dead floor remains — slash cannot land on exited holders.
		assert_noop!(Edot::apply_slash(RuntimeOrigin::root(), 40), Error::<Test>::NothingToSlash);
	});
}

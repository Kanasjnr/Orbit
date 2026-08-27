use crate::{mock::*, Error, Event, Shares, TotalAssets, TotalShares};
use frame::testing_prelude::*;
use polkadot_sdk::pallet_balances::Pallet as BalancesPallet;

fn vault_free() -> u128 {
	Balances::free_balance(Odot::account_id())
}

#[test]
fn genesis_seeds_dead_shares() {
	new_test_ext().execute_with(|| {
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get());
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(vault_free(), DeadShares::get());
	});
}

#[test]
fn deposit_mints_one_to_one_at_genesis_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
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
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let shares_before = Shares::<Test>::get(ALICE);
		assert_ok!(Odot::do_credit_rewards(100));
		assert_eq!(Shares::<Test>::get(ALICE), shares_before);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 200);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		// 100 shares redeem for floor(100 * V / S) = floor(100 * 1200 / 1100) = 109
		assert_eq!(Odot::convert_to_assets(100).unwrap(), 109);
	});
}

#[test]
fn redeem_returns_pro_rata_assets() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Odot::do_credit_rewards(100));
		let alice_bal_before = Balances::free_balance(ALICE);
		assert_ok!(Odot::redeem(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(Balances::free_balance(ALICE) - alice_bal_before, 109);
		// Dead shares remain as the inflation floor.
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 91);
		assert_eq!(vault_free(), DeadShares::get() + 91);
	});
}

#[test]
fn second_depositor_gets_fewer_shares_after_accrual() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Odot::do_credit_rewards(100));
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(BOB), 100));
		// Bob: floor(100 * 1100 / 1200) = 91
		assert_eq!(Shares::<Test>::get(BOB), 91);
		assert!(Shares::<Test>::get(BOB) < Shares::<Test>::get(ALICE));
	});
}

#[test]
fn deposit_below_minimum_fails() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			Odot::deposit(RuntimeOrigin::signed(ALICE), 1),
			Error::<Test>::DepositTooSmall
		);
	});
}

#[test]
fn redeem_more_than_balance_fails() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_noop!(
			Odot::redeem(RuntimeOrigin::signed(ALICE), 101),
			Error::<Test>::InsufficientShares
		);
	});
}

#[test]
fn zero_redeem_fails() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_noop!(
			Odot::redeem(RuntimeOrigin::signed(ALICE), 0),
			Error::<Test>::ZeroSharesRedeem
		);
	});
}

#[test]
fn partial_redeem_leaves_remaining_shares() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let before = Balances::free_balance(ALICE);
		assert_ok!(Odot::redeem(RuntimeOrigin::signed(ALICE), 40));
		assert_eq!(Shares::<Test>::get(ALICE), 60);
		assert_eq!(Balances::free_balance(ALICE) - before, 40);
		assert_eq!(vault_free(), DeadShares::get() + 60);
	});
}

#[test]
fn donation_to_vault_does_not_inflate_mint_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(BalancesPallet::<Test>::transfer_allow_death(
			RuntimeOrigin::signed(BOB),
			Odot::account_id(),
			500,
		));
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 100);
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(BOB), 100));
		assert_eq!(Shares::<Test>::get(BOB), 100);
	});
}

#[test]
fn queued_redeem_pays_after_unbond() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		let before = Balances::free_balance(ALICE);
		assert_ok!(Odot::request_redeem(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
		assert_noop!(
			Odot::claim_redeem(RuntimeOrigin::signed(ALICE), 0),
			Error::<Test>::NotUnlocked
		);
		System::set_block_number(System::block_number() + UnbondingPeriod::get());
		assert_ok!(Odot::claim_redeem(RuntimeOrigin::signed(ALICE), 0));
		assert_eq!(Balances::free_balance(ALICE) - before, 100);
	});
}

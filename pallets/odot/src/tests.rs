use crate::{mock::*, Error, Event, Shares, TotalAssets, TotalShares};
use frame::testing_prelude::*;

#[test]
fn genesis_seeds_dead_shares() {
	new_test_ext().execute_with(|| {
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get());
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		assert_eq!(Shares::<Test>::get(ALICE), 0);
	});
}

#[test]
fn deposit_mints_one_to_one_at_genesis_rate() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 100);
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 100);
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get() + 100);
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
		assert_ok!(Odot::accrue_rewards(RuntimeOrigin::root(), 100));
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
		assert_ok!(Odot::accrue_rewards(RuntimeOrigin::root(), 100));
		let alice_bal_before = Balances::free_balance(ALICE);
		assert_ok!(Odot::redeem(RuntimeOrigin::signed(ALICE), 100));
		assert_eq!(Shares::<Test>::get(ALICE), 0);
		assert_eq!(Balances::free_balance(ALICE) - alice_bal_before, 109);
		// Dead shares remain as the inflation floor.
		assert_eq!(TotalShares::<Test>::get(), DeadShares::get());
		assert_eq!(TotalAssets::<Test>::get(), DeadShares::get() + 91);
	});
}

#[test]
fn second_depositor_gets_fewer_shares_after_accrual() {
	new_test_ext().execute_with(|| {
		assert_ok!(Odot::deposit(RuntimeOrigin::signed(ALICE), 100));
		assert_ok!(Odot::accrue_rewards(RuntimeOrigin::root(), 100));
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
fn non_admin_cannot_accrue() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			Odot::accrue_rewards(RuntimeOrigin::signed(ALICE), 10),
			DispatchError::BadOrigin
		);
	});
}

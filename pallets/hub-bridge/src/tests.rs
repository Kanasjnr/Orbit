use crate::{
	mock::*, Error, Event, NextWithdrawalId, PendingWithdrawals, ProcessedHubEvents, Withdrawal,
};
use frame::{deps::sp_runtime::TokenError, testing_prelude::*};

#[test]
fn bridge_deposit_credits_local_balance() {
	new_test_ext().execute_with(|| {
		let before = Balances::free_balance(BOB);
		assert_ok!(HubBridge::report_bridge_deposit(feed_origin(), eid(1), 5, BOB, 250));
		assert_eq!(Balances::free_balance(BOB) - before, 250);
		assert!(ProcessedHubEvents::<Test>::contains_key(eid(1)));
		System::assert_last_event(
			Event::DepositBridged { hub_event_id: eid(1), era: 5, account: BOB, amount: 250 }
				.into(),
		);
	});
}

#[test]
fn bridge_deposit_zero_amount_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubBridge::report_bridge_deposit(feed_origin(), eid(2), 1, BOB, 0),
			Error::<Test>::ZeroAmount
		);
	});
}

#[test]
fn bridge_deposit_duplicate_event_rejected() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubBridge::report_bridge_deposit(feed_origin(), eid(3), 1, BOB, 10));
		assert_noop!(
			HubBridge::report_bridge_deposit(feed_origin(), eid(3), 1, BOB, 10),
			Error::<Test>::DuplicateHubEvent
		);
	});
}

#[test]
fn bridge_deposit_non_oracle_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubBridge::report_bridge_deposit(RuntimeOrigin::signed(ALICE), eid(4), 1, BOB, 10),
			DispatchError::BadOrigin
		);
		assert_noop!(
			HubBridge::report_bridge_deposit(RuntimeOrigin::root(), eid(4), 1, BOB, 10),
			DispatchError::BadOrigin
		);
	});
}

#[test]
fn withdrawal_request_burns_and_queues() {
	new_test_ext().execute_with(|| {
		let before = Balances::free_balance(ALICE);
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 300, BOB));
		assert_eq!(before - Balances::free_balance(ALICE), 300);
		assert_eq!(NextWithdrawalId::<Test>::get(), 1);
		assert_eq!(
			PendingWithdrawals::<Test>::get(0),
			Some(Withdrawal { who: ALICE, amount: 300, hub_beneficiary: BOB }),
		);
		System::assert_last_event(
			Event::WithdrawalRequested { id: 0, who: ALICE, amount: 300, hub_beneficiary: BOB }
				.into(),
		);
	});
}

#[test]
fn withdrawal_request_ids_increment() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 100, BOB));
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 100, BOB));
		assert_eq!(NextWithdrawalId::<Test>::get(), 2);
		assert!(PendingWithdrawals::<Test>::get(0).is_some());
		assert!(PendingWithdrawals::<Test>::get(1).is_some());
	});
}

#[test]
fn withdrawal_request_zero_amount_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 0, BOB),
			Error::<Test>::ZeroAmount
		);
	});
}

#[test]
fn withdrawal_request_insufficient_balance_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 10_000, BOB),
			TokenError::FundsUnavailable
		);
	});
}

#[test]
fn withdrawal_fulfilled_clears_pending_record() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 100, BOB));
		assert_ok!(HubBridge::report_withdrawal_fulfilled(feed_origin(), 0, eid(5)));
		assert!(PendingWithdrawals::<Test>::get(0).is_none());
		assert!(ProcessedHubEvents::<Test>::contains_key(eid(5)));
		System::assert_last_event(
			Event::WithdrawalFulfilled { id: 0, hub_event_id: eid(5) }.into(),
		);
	});
}

#[test]
fn withdrawal_fulfilled_unknown_id_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubBridge::report_withdrawal_fulfilled(feed_origin(), 99, eid(6)),
			Error::<Test>::UnknownWithdrawal
		);
	});
}

#[test]
fn withdrawal_fulfilled_non_oracle_rejected() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 100, BOB));
		assert_noop!(
			HubBridge::report_withdrawal_fulfilled(RuntimeOrigin::signed(ALICE), 0, eid(7)),
			DispatchError::BadOrigin
		);
	});
}

/// Deposit and fulfillment reports share one dedup namespace, matching pallet-hub-feed's
/// existing pattern of one ProcessedHubEvents set across multiple report call kinds.
#[test]
fn deposit_and_fulfillment_share_dedup_namespace() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubBridge::report_bridge_deposit(feed_origin(), eid(8), 1, BOB, 10));
		assert_ok!(HubBridge::request_withdrawal(RuntimeOrigin::signed(ALICE), 50, BOB));
		assert_noop!(
			HubBridge::report_withdrawal_fulfilled(feed_origin(), 0, eid(8)),
			Error::<Test>::DuplicateHubEvent
		);
	});
}

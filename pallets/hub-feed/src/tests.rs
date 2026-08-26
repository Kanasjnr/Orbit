use crate::{mock::*, Error, Event, LastReportedEra, ProcessedHubEvents};
use frame::testing_prelude::*;

#[test]
fn nomination_reward_credits_odot_sink() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubFeed::report_nomination_reward(RuntimeOrigin::root(), eid(1), 10, 50));
		assert_eq!(nom_credited(), 50);
		assert_eq!(self_credited(), 0);
		assert_eq!(LastReportedEra::<Test>::get(), 10);
		assert!(ProcessedHubEvents::<Test>::contains_key(eid(1)));
		System::assert_last_event(
			Event::NominationRewardReported { hub_event_id: eid(1), era: 10, amount: 50 }.into(),
		);
	});
}

#[test]
fn self_stake_reward_credits_edot_sink() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubFeed::report_self_stake_reward(RuntimeOrigin::root(), eid(2), 11, 70));
		assert_eq!(self_credited(), 70);
		assert_eq!(nom_credited(), 0);
	});
}

#[test]
fn slash_hits_edot_only() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubFeed::report_slash(RuntimeOrigin::root(), eid(3), 12, 40));
		assert_eq!(slashed(), 40);
		assert_eq!(nom_credited(), 0);
	});
}

#[test]
fn slash_respects_sink_cap() {
	new_test_ext().execute_with(|| {
		set_slash_cap(25);
		assert_ok!(HubFeed::report_slash(RuntimeOrigin::root(), eid(4), 12, 100));
		assert_eq!(slashed(), 25);
	});
}

#[test]
fn duplicate_hub_event_rejected() {
	new_test_ext().execute_with(|| {
		assert_ok!(HubFeed::report_nomination_reward(RuntimeOrigin::root(), eid(5), 1, 10));
		assert_noop!(
			HubFeed::report_nomination_reward(RuntimeOrigin::root(), eid(5), 1, 10),
			Error::<Test>::DuplicateHubEvent
		);
		assert_eq!(nom_credited(), 10);
	});
}

#[test]
fn zero_amount_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubFeed::report_slash(RuntimeOrigin::root(), eid(6), 1, 0),
			Error::<Test>::ZeroAmount
		);
	});
}

#[test]
fn non_feed_origin_rejected() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			HubFeed::report_nomination_reward(RuntimeOrigin::signed(1), eid(7), 1, 10),
			DispatchError::BadOrigin
		);
	});
}

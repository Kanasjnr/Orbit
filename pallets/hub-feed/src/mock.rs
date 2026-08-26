use crate::{traits::*, Config as HubConfig};
use core::cell::RefCell;
use frame::{
	deps::{
		frame_support::weights::constants::RocksDbWeight,
		frame_system::GenesisConfig as SystemGenesisConfig,
		sp_runtime::BuildStorage,
	},
	prelude::*,
	runtime::prelude::*,
	testing_prelude::*,
	traits::ConstU64,
};

type Balance = u128;

thread_local! {
	static NOM_CREDITED: RefCell<Balance> = const { RefCell::new(0) };
	static SELF_CREDITED: RefCell<Balance> = const { RefCell::new(0) };
	static SLASHED: RefCell<Balance> = const { RefCell::new(0) };
	static SLASH_CAP: RefCell<Balance> = const { RefCell::new(u128::MAX) };
}

pub fn reset_sinks() {
	NOM_CREDITED.with(|v| *v.borrow_mut() = 0);
	SELF_CREDITED.with(|v| *v.borrow_mut() = 0);
	SLASHED.with(|v| *v.borrow_mut() = 0);
	SLASH_CAP.with(|v| *v.borrow_mut() = u128::MAX);
}

pub fn nom_credited() -> Balance {
	NOM_CREDITED.with(|v| *v.borrow())
}
pub fn self_credited() -> Balance {
	SELF_CREDITED.with(|v| *v.borrow())
}
pub fn slashed() -> Balance {
	SLASHED.with(|v| *v.borrow())
}
pub fn set_slash_cap(cap: Balance) {
	SLASH_CAP.with(|v| *v.borrow_mut() = cap);
}

#[frame_construct_runtime]
mod test_runtime {
	#[runtime::runtime]
	#[runtime::derive(
		RuntimeCall,
		RuntimeEvent,
		RuntimeError,
		RuntimeOrigin,
		RuntimeFreezeReason,
		RuntimeHoldReason,
		RuntimeSlashReason,
		RuntimeLockId,
		RuntimeTask,
		RuntimeViewFunction
	)]
	pub struct Test;

	#[runtime::pallet_index(0)]
	pub type System = frame_system;
	#[runtime::pallet_index(1)]
	pub type HubFeed = crate;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = MockBlock<Test>;
	type BlockHashCount = ConstU64<250>;
	type DbWeight = RocksDbWeight;
}

pub struct MockNomination;
impl NominationRewardSink for MockNomination {
	type Balance = Balance;
	fn credit_nomination_rewards(amount: Self::Balance) -> DispatchResult {
		NOM_CREDITED.with(|v| *v.borrow_mut() += amount);
		Ok(())
	}
}

pub struct MockSelfStake;
impl SelfStakeVaultSink for MockSelfStake {
	type Balance = Balance;
	fn credit_self_stake_rewards(amount: Self::Balance) -> DispatchResult {
		SELF_CREDITED.with(|v| *v.borrow_mut() += amount);
		Ok(())
	}
	fn apply_hub_slash(amount: Self::Balance) -> Result<Self::Balance, DispatchError> {
		let cap = SLASH_CAP.with(|v| *v.borrow());
		let applied = amount.min(cap);
		SLASHED.with(|v| *v.borrow_mut() += applied);
		Ok(applied)
	}
}

impl HubConfig for Test {
	type RuntimeEvent = RuntimeEvent;
	type FeedOrigin = frame_system::EnsureRoot<u64>;
	type NominationVault = MockNomination;
	type SelfStakeVault = MockSelfStake;
	type WeightInfo = ();
}

pub fn new_test_ext() -> TestState {
	reset_sinks();
	let t = SystemGenesisConfig::<Test>::default().build_storage().unwrap();
	let mut ext: TestState = t.into();
	ext.execute_with(|| System::set_block_number(1));
	ext
}

pub fn eid(n: u8) -> [u8; 32] {
	let mut id = [0u8; 32];
	id[0] = n;
	id
}

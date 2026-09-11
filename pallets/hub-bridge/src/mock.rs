use frame::{
	deps::{
		frame_support::{ord_parameter_types, traits::ConstU64, weights::constants::RocksDbWeight},
		frame_system::{EnsureSignedBy, GenesisConfig as SystemGenesisConfig},
		sp_runtime::BuildStorage,
	},
	prelude::*,
	runtime::prelude::*,
	testing_prelude::*,
};
use polkadot_sdk::pallet_balances;

type Balance = u128;

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
	pub type Balances = pallet_balances;
	#[runtime::pallet_index(2)]
	pub type HubBridge = crate;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type AccountData = pallet_balances::AccountData<Balance>;
	type Block = MockBlock<Test>;
	type BlockHashCount = ConstU64<250>;
	type DbWeight = RocksDbWeight;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
	type AccountStore = System;
	type Balance = Balance;
	type ExistentialDeposit = frame::deps::frame_support::traits::ConstU128<1>;
	type RuntimeHoldReason = RuntimeHoldReason;
	type RuntimeFreezeReason = RuntimeFreezeReason;
}

ord_parameter_types! {
	pub const FeedOracle: u64 = 42;
}

impl crate::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Currency = Balances;
	type FeedOrigin = EnsureSignedBy<FeedOracle, u64>;
	type WeightInfo = ();
}

pub const ALICE: u64 = 1;
pub const BOB: u64 = 2;

pub fn feed_origin() -> RuntimeOrigin {
	RuntimeOrigin::signed(FeedOracle::get())
}

pub fn new_test_ext() -> TestState {
	let mut t = SystemGenesisConfig::<Test>::default().build_storage().unwrap();
	pallet_balances::GenesisConfig::<Test> {
		balances: vec![(ALICE, 1_000), (BOB, 1_000)],
		..Default::default()
	}
	.assimilate_storage(&mut t)
	.unwrap();
	let mut ext: TestState = t.into();
	ext.execute_with(|| System::set_block_number(1));
	ext
}

pub fn eid(n: u8) -> [u8; 32] {
	let mut id = [0u8; 32];
	id[0] = n;
	id
}

//! Placeholder weights for `pallet-hub-bridge`.

#![cfg_attr(rustfmt, rustfmt_skip)]
#![allow(unused_parens)]
#![allow(unused_imports)]

use core::marker::PhantomData;
use frame::{deps::frame_support::weights::constants::RocksDbWeight, prelude::*};

pub trait WeightInfo {
	fn report_bridge_deposit() -> Weight;
	fn request_withdrawal() -> Weight;
	fn report_withdrawal_fulfilled() -> Weight;
}

#[cfg_attr(
	not(feature = "std"),
	deprecated(
		note = "SubstrateWeight is a placeholder; replace with runtime-benchmarked weights before production."
	)
)]
pub struct SubstrateWeight<T>(PhantomData<T>);
impl<T: frame_system::Config> WeightInfo for SubstrateWeight<T> {
	fn report_bridge_deposit() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(2_u64))
			.saturating_add(T::DbWeight::get().writes(2_u64))
	}
	fn request_withdrawal() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(2_u64))
			.saturating_add(T::DbWeight::get().writes(2_u64))
	}
	fn report_withdrawal_fulfilled() -> Weight {
		Weight::from_parts(30_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(2_u64))
			.saturating_add(T::DbWeight::get().writes(2_u64))
	}
}

impl WeightInfo for () {
	fn report_bridge_deposit() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(RocksDbWeight::get().reads(2_u64))
			.saturating_add(RocksDbWeight::get().writes(2_u64))
	}
	fn request_withdrawal() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(RocksDbWeight::get().reads(2_u64))
			.saturating_add(RocksDbWeight::get().writes(2_u64))
	}
	fn report_withdrawal_fulfilled() -> Weight {
		Weight::from_parts(30_000_000, 0)
			.saturating_add(RocksDbWeight::get().reads(2_u64))
			.saturating_add(RocksDbWeight::get().writes(2_u64))
	}
}

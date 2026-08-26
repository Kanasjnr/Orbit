//! Placeholder weights for `pallet-edot` (replace with runtime benchmarks before mainnet).

#![cfg_attr(rustfmt, rustfmt_skip)]
#![allow(unused_parens)]
#![allow(unused_imports)]

use core::marker::PhantomData;
use frame::{deps::frame_support::weights::constants::RocksDbWeight, prelude::*};

pub trait WeightInfo {
	fn deposit() -> Weight;
	fn request_redeem() -> Weight;
	fn claim_redeem() -> Weight;
	fn accrue_rewards() -> Weight;
	fn apply_slash() -> Weight;
}

fn reads_writes(r: u64, w: u64) -> Weight {
	Weight::from_parts(50_000_000, 0)
		.saturating_add(RocksDbWeight::get().reads(r))
		.saturating_add(RocksDbWeight::get().writes(w))
}

#[cfg_attr(
	not(feature = "std"),
	deprecated(
		note = "SubstrateWeight is a placeholder; replace with runtime-benchmarked weights before production."
	)
)]
pub struct SubstrateWeight<T>(PhantomData<T>);
impl<T: frame_system::Config> WeightInfo for SubstrateWeight<T> {
	fn deposit() -> Weight {
		Weight::from_parts(50_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(4_u64))
			.saturating_add(T::DbWeight::get().writes(4_u64))
	}
	fn request_redeem() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(3_u64))
			.saturating_add(T::DbWeight::get().writes(3_u64))
	}
	fn claim_redeem() -> Weight {
		Weight::from_parts(50_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(4_u64))
			.saturating_add(T::DbWeight::get().writes(4_u64))
	}
	fn accrue_rewards() -> Weight {
		Weight::from_parts(30_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(2_u64))
			.saturating_add(T::DbWeight::get().writes(2_u64))
	}
	fn apply_slash() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(T::DbWeight::get().reads(2_u64))
			.saturating_add(T::DbWeight::get().writes(3_u64))
	}
}

impl WeightInfo for () {
	fn deposit() -> Weight { reads_writes(4, 4) }
	fn request_redeem() -> Weight { reads_writes(3, 3) }
	fn claim_redeem() -> Weight { reads_writes(4, 4) }
	fn accrue_rewards() -> Weight {
		Weight::from_parts(30_000_000, 0)
			.saturating_add(RocksDbWeight::get().reads(2_u64))
			.saturating_add(RocksDbWeight::get().writes(2_u64))
	}
	fn apply_slash() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(RocksDbWeight::get().reads(2_u64))
			.saturating_add(RocksDbWeight::get().writes(3_u64))
	}
}

//! # Hub feed pallet
//!
//! Ingress for **observed** Polkadot Hub staking outcomes into Orbit vaults (§17 MVP).
//!
//! Chopsticks (or a future oracle) reads Hub-shaped staking storage / events and submits:
//! - nomination rewards → oDOT (`V_oDOT` only)
//! - self-stake rewards → eDOT
//! - self-stake slash → eDOT only (§10.1A; never oDOT)
//!
//! Each report carries a `hub_event_id` so the same Hub event cannot be applied twice.
#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;
pub use traits::{NominationRewardSink, SelfStakeVaultSink};

pub mod traits;
pub mod weights;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

#[frame::pallet]
pub mod pallet {
	use crate::{
		traits::{NominationRewardSink, SelfStakeVaultSink},
		weights::WeightInfo,
	};
	use frame::{prelude::*, traits::EnsureOrigin};

	/// Opaque Hub event id (block+index hash, extrinsic hash, or Chopsticks-derived key).
	pub type HubEventId = [u8; 32];

	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Origin allowed to submit observed Hub events (Root in PoC; oracle later).
		type FeedOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// oDOT nomination vault sink.
		type NominationVault: NominationRewardSink;

		/// eDOT self-stake vault sink (rewards + slash). Balance must match nomination vault.
		type SelfStakeVault: SelfStakeVaultSink<
			Balance = <Self::NominationVault as NominationRewardSink>::Balance,
		>;

		type WeightInfo: WeightInfo;
	}

	type BalanceOf<T> = <<T as Config>::NominationVault as NominationRewardSink>::Balance;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Hub event ids already applied (dedup).
	#[pallet::storage]
	pub type ProcessedHubEvents<T: Config> =
		StorageMap<_, Blake2_128Concat, HubEventId, (), OptionQuery>;

	/// Last Hub era index successfully reported (observability).
	#[pallet::storage]
	pub type LastReportedEra<T: Config> = StorageValue<_, u32, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// Nomination rewards credited to oDOT.
		NominationRewardReported { hub_event_id: HubEventId, era: u32, amount: BalanceOf<T> },
		/// Self-stake rewards credited to eDOT.
		SelfStakeRewardReported { hub_event_id: HubEventId, era: u32, amount: BalanceOf<T> },
		/// Hub slash applied to eDOT (`applied` may be less than `amount` if capped).
		SlashReported {
			hub_event_id: HubEventId,
			era: u32,
			amount: BalanceOf<T>,
			applied: BalanceOf<T>,
		},
	}

	#[pallet::error]
	pub enum Error<T> {
		/// This `hub_event_id` was already processed.
		DuplicateHubEvent,
		/// Reported amount is zero.
		ZeroAmount,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Report Hub nomination rewards attributed to the oDOT vault.
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::report_nomination_reward())]
		pub fn report_nomination_reward(
			origin: OriginFor<T>,
			hub_event_id: HubEventId,
			era: u32,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			T::FeedOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			Self::ensure_fresh_event(&hub_event_id)?;

			T::NominationVault::credit_nomination_rewards(amount)?;
			Self::mark_processed(hub_event_id, era);
			Self::deposit_event(Event::NominationRewardReported { hub_event_id, era, amount });
			Ok(())
		}

		/// Report Hub self-stake / incentive rewards attributed to the eDOT vault.
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::report_self_stake_reward())]
		pub fn report_self_stake_reward(
			origin: OriginFor<T>,
			hub_event_id: HubEventId,
			era: u32,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			T::FeedOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			Self::ensure_fresh_event(&hub_event_id)?;

			T::SelfStakeVault::credit_self_stake_rewards(amount)?;
			Self::mark_processed(hub_event_id, era);
			Self::deposit_event(Event::SelfStakeRewardReported { hub_event_id, era, amount });
			Ok(())
		}

		/// Report a Hub self-stake slash; applied to eDOT only (§10.1A).
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::report_slash())]
		pub fn report_slash(
			origin: OriginFor<T>,
			hub_event_id: HubEventId,
			era: u32,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			T::FeedOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			Self::ensure_fresh_event(&hub_event_id)?;

			let applied = T::SelfStakeVault::apply_hub_slash(amount)?;
			Self::mark_processed(hub_event_id, era);
			Self::deposit_event(Event::SlashReported { hub_event_id, era, amount, applied });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		fn ensure_fresh_event(id: &HubEventId) -> Result<(), Error<T>> {
			ensure!(!ProcessedHubEvents::<T>::contains_key(id), Error::<T>::DuplicateHubEvent);
			Ok(())
		}

		fn mark_processed(id: HubEventId, era: u32) {
			ProcessedHubEvents::<T>::insert(id, ());
			LastReportedEra::<T>::put(era);
		}
	}
}

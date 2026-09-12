//! # Hub bridge pallet
//!
//! Credits Orbit-local balance once the oracle confirms a depositor sent DOT to Orbit's
//! Hub-side receiving account, and queues withdrawal requests so the operator can send the
//! corresponding DOT back on Hub (§11.6). Same FeedOrigin trust boundary and hub_event_id
//! dedup as pallet-hub-feed, applied to balance-crediting events instead of reward/slash ones.
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

pub mod weights;

#[frame::pallet]
pub mod pallet {
	use crate::weights::WeightInfo;
	use frame::{
		prelude::*,
		traits::{
			fungible::{Inspect, Mutate},
			tokens::{Fortitude, Precision, Preservation},
			EnsureOrigin,
		},
	};

	/// Opaque Hub event id (extrinsic hash or Chopsticks-derived key).
	pub type HubEventId = [u8; 32];

	pub type BalanceOf<T> =
		<<T as Config>::Currency as Inspect<<T as frame_system::Config>::AccountId>>::Balance;

	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Fungible credited on a confirmed deposit and burned on a withdrawal request.
		type Currency: Mutate<Self::AccountId>;

		/// Origin allowed to submit observed Hub events (dedicated oracle key; not Root).
		type FeedOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		type WeightInfo: WeightInfo;
	}

	/// A queued withdrawal awaiting Hub-side fulfillment.
	#[derive(Encode, Decode, MaxEncodedLen, TypeInfo, Clone, PartialEq, Eq, RuntimeDebug)]
	pub struct Withdrawal<AccountId, Balance> {
		pub who: AccountId,
		pub amount: Balance,
		pub hub_beneficiary: AccountId,
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Hub event ids already applied (dedup); shared across deposit and fulfillment reports.
	#[pallet::storage]
	pub type ProcessedHubEvents<T: Config> =
		StorageMap<_, Blake2_128Concat, HubEventId, (), OptionQuery>;

	/// Queued withdrawals awaiting Hub-side fulfillment.
	#[pallet::storage]
	pub type PendingWithdrawals<T: Config> =
		StorageMap<_, Blake2_128Concat, u64, Withdrawal<T::AccountId, BalanceOf<T>>>;

	/// Next withdrawal request id.
	#[pallet::storage]
	pub type NextWithdrawalId<T: Config> = StorageValue<_, u64, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A Hub-side deposit was observed and credited as local balance.
		DepositBridged {
			hub_event_id: HubEventId,
			era: u32,
			account: T::AccountId,
			amount: BalanceOf<T>,
		},
		/// `who` burned local balance and queued withdrawal `id` to `hub_beneficiary` on Hub.
		WithdrawalRequested {
			id: u64,
			who: T::AccountId,
			amount: BalanceOf<T>,
			hub_beneficiary: T::AccountId,
		},
		/// Withdrawal `id` was fulfilled on Hub.
		WithdrawalFulfilled { id: u64, hub_event_id: HubEventId },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// This `hub_event_id` was already processed.
		DuplicateHubEvent,
		/// Reported or requested amount is zero.
		ZeroAmount,
		/// No withdrawal request exists for this id.
		UnknownWithdrawal,
		/// Vault accounting would overflow (should not happen in practice).
		Arithmetic,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Credit `account` after the oracle confirms a Hub-side deposit (§11.6 leg 1).
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::report_bridge_deposit())]
		pub fn report_bridge_deposit(
			origin: OriginFor<T>,
			hub_event_id: HubEventId,
			era: u32,
			account: T::AccountId,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			T::FeedOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			Self::ensure_fresh_event(&hub_event_id)?;

			T::Currency::mint_into(&account, amount)?;
			Self::mark_processed(hub_event_id);
			Self::deposit_event(Event::DepositBridged { hub_event_id, era, account, amount });
			Ok(())
		}

		/// Burn `amount` from the caller and queue a withdrawal to `hub_beneficiary` (§11.6 leg 3).
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::request_withdrawal())]
		pub fn request_withdrawal(
			origin: OriginFor<T>,
			amount: BalanceOf<T>,
			hub_beneficiary: T::AccountId,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);

			T::Currency::burn_from(
				&who,
				amount,
				Preservation::Expendable,
				Precision::Exact,
				Fortitude::Polite,
			)?;

			let id = NextWithdrawalId::<T>::get();
			PendingWithdrawals::<T>::insert(
				id,
				Withdrawal { who: who.clone(), amount, hub_beneficiary: hub_beneficiary.clone() },
			);
			NextWithdrawalId::<T>::put(id.checked_add(1).ok_or(Error::<T>::Arithmetic)?);

			Self::deposit_event(Event::WithdrawalRequested { id, who, amount, hub_beneficiary });
			Ok(())
		}

		/// Mark withdrawal `id` fulfilled once the oracle confirms Hub-side payout (§11.6 leg 3).
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::report_withdrawal_fulfilled())]
		pub fn report_withdrawal_fulfilled(
			origin: OriginFor<T>,
			id: u64,
			hub_event_id: HubEventId,
		) -> DispatchResult {
			T::FeedOrigin::ensure_origin(origin)?;
			Self::ensure_fresh_event(&hub_event_id)?;
			ensure!(PendingWithdrawals::<T>::contains_key(id), Error::<T>::UnknownWithdrawal);

			PendingWithdrawals::<T>::remove(id);
			Self::mark_processed(hub_event_id);
			Self::deposit_event(Event::WithdrawalFulfilled { id, hub_event_id });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		fn ensure_fresh_event(id: &HubEventId) -> Result<(), Error<T>> {
			ensure!(!ProcessedHubEvents::<T>::contains_key(id), Error::<T>::DuplicateHubEvent);
			Ok(())
		}

		fn mark_processed(id: HubEventId) {
			ProcessedHubEvents::<T>::insert(id, ());
		}
	}
}

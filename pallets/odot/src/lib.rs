//! # oDOT vault pallet
//!
//! Nomination-path liquid staking shares for Orbit.
//!
//! - Deposit DOT → mint oDOT shares at `rate = V / S`
//! - Redeem shares → burn and return DOT (instant for Phase B; unbond queue later)
//! - Accrue rewards by increasing `V` without minting shares (Hub wiring is Phase D)
//!
//! Hub slash never reduces `V_oDOT` (§10.1A). This pallet has no slash path.
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
		deps::frame_support::{DefaultNoBound, PalletId},
		prelude::*,
		traits::{
			fungible::{Inspect, Mutate},
			tokens::Preservation,
			EnsureOrigin,
		},
	};

	pub type BalanceOf<T> =
		<<T as Config>::Currency as Inspect<<T as frame_system::Config>::AccountId>>::Balance;

	/// Configure the pallet.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Fungible used as the vault underlying (DOT-like units on this chain for the MVP).
		type Currency: Mutate<Self::AccountId>;

		/// Deterministic vault account that holds deposited underlying.
		#[pallet::constant]
		type PalletId: Get<PalletId>;

		/// Minimum deposit accepted (after which at least one share must be minted).
		#[pallet::constant]
		type MinimumDeposit: Get<BalanceOf<Self>>;

		/// Virtual dead shares / assets burned at genesis (inflation-attack floor, §9.3).
		/// Never held by any account; never redeemable.
		#[pallet::constant]
		type DeadShares: Get<BalanceOf<Self>>;

		/// Origin allowed to credit reward accrual into `V` without minting shares.
		type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		type WeightInfo: WeightInfo;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Backing pool value `V` (DOT-denominated), including virtual dead assets.
	#[pallet::storage]
	pub type TotalAssets<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Outstanding share supply `S`, including virtual dead shares.
	#[pallet::storage]
	pub type TotalShares<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Per-account oDOT share balances (dead shares are not credited to anyone).
	#[pallet::storage]
	pub type Shares<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// `who` deposited `assets` underlying and received `shares` oDOT.
		Deposited { who: T::AccountId, assets: BalanceOf<T>, shares: BalanceOf<T> },
		/// `who` redeemed `shares` oDOT for `assets` underlying.
		Redeemed { who: T::AccountId, shares: BalanceOf<T>, assets: BalanceOf<T> },
		/// Protocol credited `amount` into `V` without minting shares (rate rises).
		RewardsAccrued { amount: BalanceOf<T>, total_assets: BalanceOf<T> },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// Deposit below `MinimumDeposit`.
		DepositTooSmall,
		/// Computed share mint rounds to zero.
		ZeroSharesMinted,
		/// Redeem amount is zero.
		ZeroSharesRedeem,
		/// Account does not hold enough shares.
		InsufficientShares,
		/// Vault accounting would underflow (should not happen if invariants hold).
		Arithmetic,
		/// Vault has no share supply to redeem against.
		EmptyVault,
	}

	#[pallet::genesis_config]
	#[derive(DefaultNoBound)]
	pub struct GenesisConfig<T: Config> {
		#[serde(skip)]
		pub _config: core::marker::PhantomData<T>,
	}

	#[pallet::genesis_build]
	impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
		fn build(&self) {
			let dead = T::DeadShares::get();
			TotalAssets::<T>::put(dead);
			TotalShares::<T>::put(dead);
			// Ensure the vault account exists as a system account for transfers.
			let vault = Pallet::<T>::account_id();
			frame_system::Pallet::<T>::inc_providers(&vault);
		}
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Deposit underlying into the oDOT vault and mint shares at the current rate.
		///
		/// `ΔS = d · S / V`, then `V += d`, `S += ΔS` (WHITEOBER §9.1).
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::deposit())]
		pub fn deposit(origin: OriginFor<T>, assets: BalanceOf<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(assets >= T::MinimumDeposit::get(), Error::<T>::DepositTooSmall);

			let vault = Self::account_id();
			let total_assets = TotalAssets::<T>::get();
			let total_shares = TotalShares::<T>::get();
			ensure!(!total_assets.is_zero() && !total_shares.is_zero(), Error::<T>::EmptyVault);

			let shares = assets
				.checked_mul(&total_shares)
				.ok_or(Error::<T>::Arithmetic)?
				.checked_div(&total_assets)
				.ok_or(Error::<T>::Arithmetic)?;
			ensure!(!shares.is_zero(), Error::<T>::ZeroSharesMinted);

			T::Currency::transfer(&who, &vault, assets, Preservation::Expendable)?;

			TotalAssets::<T>::put(
				total_assets.checked_add(&assets).ok_or(Error::<T>::Arithmetic)?,
			);
			TotalShares::<T>::put(
				total_shares.checked_add(&shares).ok_or(Error::<T>::Arithmetic)?,
			);
			Shares::<T>::try_mutate(&who, |b| -> Result<(), Error<T>> {
				*b = b.checked_add(&shares).ok_or(Error::<T>::Arithmetic)?;
				Ok(())
			})?;

			Self::deposit_event(Event::Deposited { who, assets, shares });
			Ok(())
		}

		/// Burn oDOT shares and return underlying at the current rate.
		///
		/// `d_out = s · V / S`, then `S -= s`, `V -= d_out`.
		/// Phase B redeems instantly from the vault balance; Hub unbond queue is later.
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::redeem())]
		pub fn redeem(origin: OriginFor<T>, shares: BalanceOf<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!shares.is_zero(), Error::<T>::ZeroSharesRedeem);

			let held = Shares::<T>::get(&who);
			ensure!(held >= shares, Error::<T>::InsufficientShares);

			let total_assets = TotalAssets::<T>::get();
			let total_shares = TotalShares::<T>::get();
			ensure!(!total_shares.is_zero(), Error::<T>::EmptyVault);

			let assets = shares
				.checked_mul(&total_assets)
				.ok_or(Error::<T>::Arithmetic)?
				.checked_div(&total_shares)
				.ok_or(Error::<T>::Arithmetic)?;
			ensure!(!assets.is_zero(), Error::<T>::Arithmetic);

			let vault = Self::account_id();
			T::Currency::transfer(&vault, &who, assets, Preservation::Expendable)?;

			TotalAssets::<T>::put(
				total_assets.checked_sub(&assets).ok_or(Error::<T>::Arithmetic)?,
			);
			TotalShares::<T>::put(
				total_shares.checked_sub(&shares).ok_or(Error::<T>::Arithmetic)?,
			);
			Shares::<T>::insert(&who, held.checked_sub(&shares).ok_or(Error::<T>::Arithmetic)?);

			Self::deposit_event(Event::Redeemed { who, shares, assets });
			Ok(())
		}

		/// Credit staking rewards into `V` without minting shares (rate rises).
		///
		/// MVP stub: mints underlying into the vault account. Phase D replaces this with
		/// observed Hub nomination reward events attributed to `V_oDOT` only.
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::accrue_rewards())]
		pub fn accrue_rewards(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::DepositTooSmall);

			let vault = Self::account_id();
			T::Currency::mint_into(&vault, amount)?;

			let total_assets = TotalAssets::<T>::get()
				.checked_add(&amount)
				.ok_or(Error::<T>::Arithmetic)?;
			TotalAssets::<T>::put(total_assets);

			Self::deposit_event(Event::RewardsAccrued { amount, total_assets });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Account that holds vault underlying on this parachain.
		pub fn account_id() -> T::AccountId {
			T::PalletId::get().into_account_truncating()
		}

		/// Current exchange rate numerator/denominator as `(V, S)`. Rate is `V/S`.
		pub fn rate_components() -> (BalanceOf<T>, BalanceOf<T>) {
			(TotalAssets::<T>::get(), TotalShares::<T>::get())
		}

		/// Convert assets → shares at the current rate (floored).
		pub fn convert_to_shares(assets: BalanceOf<T>) -> Result<BalanceOf<T>, Error<T>> {
			let (v, s) = Self::rate_components();
			ensure!(!v.is_zero() && !s.is_zero(), Error::<T>::EmptyVault);
			assets
				.checked_mul(&s)
				.ok_or(Error::<T>::Arithmetic)?
				.checked_div(&v)
				.ok_or(Error::<T>::Arithmetic)
		}

		/// Convert shares → assets at the current rate (floored).
		pub fn convert_to_assets(shares: BalanceOf<T>) -> Result<BalanceOf<T>, Error<T>> {
			let (v, s) = Self::rate_components();
			ensure!(!s.is_zero(), Error::<T>::EmptyVault);
			shares
				.checked_mul(&v)
				.ok_or(Error::<T>::Arithmetic)?
				.checked_div(&s)
				.ok_or(Error::<T>::Arithmetic)
		}

		/// Preview redeemable assets for `who`'s full balance.
		pub fn assets_of(who: &T::AccountId) -> Result<BalanceOf<T>, Error<T>> {
			Self::convert_to_assets(Shares::<T>::get(who))
		}
	}
}

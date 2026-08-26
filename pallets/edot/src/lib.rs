//! # eDOT vault pallet
//!
//! Validator self-stake liquid staking shares for Orbit.
//!
//! - Deposit DOT → mint eDOT shares at `rate = V / S`
//! - Protocol redeem queues for `UnbondingPeriod` then pays at claim-time rate (§12, §14.5)
//! - Accrue rewards by increasing `V` without minting shares (Hub observation is later)
//! - Apply Hub slash by decreasing `V` without burning shares (rate falls, §10.1A)
//!
//! Queued shares stay in `S` until claim, so a slash during unbond still socializes.
//!
//! Hub slash hits eDOT only. oDOT has no slash path; this pallet does.
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
			tokens::{Fortitude, Precision, Preservation},
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

		/// Real dead shares / assets locked in the vault at genesis (inflation-attack floor, §9.3).
		/// Never held by any account; never redeemable.
		#[pallet::constant]
		type DeadShares: Get<BalanceOf<Self>>;

		/// Origin allowed to credit rewards or apply Hub slash accounting into `V`.
		type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// Blocks a protocol redeem must wait before `claim_redeem` (MVP stand-in for Hub unbond).
		#[pallet::constant]
		type UnbondingPeriod: Get<BlockNumberFor<Self>>;

		type WeightInfo: WeightInfo;
	}

	/// Shares locked in a protocol redeem, still counted in `S` (and slashable) until claimed.
	#[derive(Encode, Decode, MaxEncodedLen, TypeInfo, Clone, PartialEq, Eq, RuntimeDebug)]
	pub struct RedeemRequest<Balance, BlockNumber> {
		pub shares: Balance,
		pub unlock_at: BlockNumber,
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Backing pool value `V` (DOT-denominated), including virtual dead assets.
	#[pallet::storage]
	pub type TotalAssets<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Outstanding share supply `S`, including virtual dead shares.
	#[pallet::storage]
	pub type TotalShares<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Per-account eDOT share balances (dead shares are not credited to anyone).
	#[pallet::storage]
	pub type Shares<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

	/// Cumulative Hub slash amount applied to this vault (observability).
	#[pallet::storage]
	pub type TotalSlashed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Per-account protocol redeem queue. Shares are deducted from `Shares` but remain in `S`.
	#[pallet::storage]
	pub type RedeemRequests<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		Twox64Concat,
		u64,
		RedeemRequest<BalanceOf<T>, BlockNumberFor<T>>,
	>;

	/// Next redeem request id per account.
	#[pallet::storage]
	pub type NextRedeemId<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// `who` deposited `assets` underlying and received `shares` eDOT.
		Deposited { who: T::AccountId, assets: BalanceOf<T>, shares: BalanceOf<T> },
		/// `who` queued `shares` for protocol redeem; claimable at `unlock_at`.
		RedeemRequested {
			who: T::AccountId,
			id: u64,
			shares: BalanceOf<T>,
			unlock_at: BlockNumberFor<T>,
		},
		/// `who` claimed queued redeem `id` for `assets` underlying.
		RedeemClaimed { who: T::AccountId, id: u64, shares: BalanceOf<T>, assets: BalanceOf<T> },
		/// Protocol credited `amount` into `V` without minting shares (rate rises).
		RewardsAccrued { amount: BalanceOf<T>, total_assets: BalanceOf<T> },
		/// Hub slash deducted `amount` from `V` without burning shares (rate falls, §10.1A).
		Slashed { amount: BalanceOf<T>, total_assets: BalanceOf<T> },
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
		/// Slash amount is zero.
		ZeroSlash,
		/// No real (non-dead) assets available to slash.
		NothingToSlash,
		/// Redeem request does not exist for this account.
		UnknownRedeemRequest,
		/// Unbonding period has not elapsed.
		NotUnlocked,
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
			// Lock real dead assets in the vault (ERC-4626-style floor). Virtual-only
			// dead assets break slash+redeem: live claims can exceed vault balance.
			if !dead.is_zero() {
				T::Currency::mint_into(&vault, dead)
					.expect("mint dead shares into eDOT vault at genesis");
			}
		}
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Deposit underlying into the eDOT vault and mint shares at the current rate.
		///
		/// `ΔS = d · S / V`, then `V += d`, `S += ΔS` (WHITEPAPER §9.1).
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

		/// Queue a protocol redeem. Shares leave the free balance but stay in `S` until claim,
		/// so they remain exposed to Hub slash during the unbonding window .
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::request_redeem())]
		pub fn request_redeem(origin: OriginFor<T>, shares: BalanceOf<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!shares.is_zero(), Error::<T>::ZeroSharesRedeem);

			let held = Shares::<T>::get(&who);
			ensure!(held >= shares, Error::<T>::InsufficientShares);

			Shares::<T>::insert(&who, held.checked_sub(&shares).ok_or(Error::<T>::Arithmetic)?);

			let id = NextRedeemId::<T>::get(&who);
			let unlock_at = frame_system::Pallet::<T>::block_number()
				.saturating_add(T::UnbondingPeriod::get());
			RedeemRequests::<T>::insert(
				&who,
				id,
				RedeemRequest { shares, unlock_at },
			);
			NextRedeemId::<T>::insert(&who, id.checked_add(1).ok_or(Error::<T>::Arithmetic)?);

			Self::deposit_event(Event::RedeemRequested { who, id, shares, unlock_at });
			Ok(())
		}

		/// Pay a matured protocol redeem at the **current** rate (`d_out = s · V / S`).
		#[pallet::call_index(4)]
		#[pallet::weight(T::WeightInfo::claim_redeem())]
		pub fn claim_redeem(origin: OriginFor<T>, id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;
			let req = RedeemRequests::<T>::take(&who, id).ok_or(Error::<T>::UnknownRedeemRequest)?;
			ensure!(
				frame_system::Pallet::<T>::block_number() >= req.unlock_at,
				Error::<T>::NotUnlocked
			);

			let total_assets = TotalAssets::<T>::get();
			let total_shares = TotalShares::<T>::get();
			ensure!(!total_shares.is_zero(), Error::<T>::EmptyVault);

			let assets = req
				.shares
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
				total_shares.checked_sub(&req.shares).ok_or(Error::<T>::Arithmetic)?,
			);

			Self::deposit_event(Event::RedeemClaimed {
				who,
				id,
				shares: req.shares,
				assets,
			});
			Ok(())
		}

		/// Credit staking rewards into `V` without minting shares (rate rises).
		///
		/// Ops fallback. Prefer `pallet-hub-feed` reporting observed Hub self-stake rewards.
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::accrue_rewards())]
		pub fn accrue_rewards(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			Self::do_credit_rewards(amount)
		}

		/// Apply a Hub self-stake slash to the eDOT vault.
		///
		/// Ops fallback. Prefer `pallet-hub-feed` reporting observed Hub slash events.
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::apply_slash())]
		pub fn apply_slash(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			Self::do_apply_slash(amount).map(|_| ())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Account that holds vault underlying on this parachain.
		pub fn account_id() -> T::AccountId {
			T::PalletId::get().into_account_truncating()
		}

		/// Credit `amount` into `V` (mint into vault). Used by hub-feed and admin accrue.
		pub fn do_credit_rewards(amount: BalanceOf<T>) -> DispatchResult {
			ensure!(!amount.is_zero(), Error::<T>::DepositTooSmall);

			let vault = Self::account_id();
			T::Currency::mint_into(&vault, amount)?;

			let total_assets =
				TotalAssets::<T>::get().checked_add(&amount).ok_or(Error::<T>::Arithmetic)?;
			TotalAssets::<T>::put(total_assets);

			Self::deposit_event(Event::RewardsAccrued { amount, total_assets });
			Ok(())
		}

		/// Apply slash of up to `amount`, capped at non-dead assets. Returns applied amount.
		pub fn do_apply_slash(amount: BalanceOf<T>) -> Result<BalanceOf<T>, DispatchError> {
			ensure!(!amount.is_zero(), Error::<T>::ZeroSlash);

			let total_assets = TotalAssets::<T>::get();
			let dead = T::DeadShares::get();
			let slashable = total_assets.saturating_sub(dead);
			ensure!(!slashable.is_zero(), Error::<T>::NothingToSlash);

			let applied = amount.min(slashable);
			let new_total = total_assets.checked_sub(&applied).ok_or(Error::<T>::Arithmetic)?;

			let vault = Self::account_id();
			let burned = T::Currency::burn_from(
				&vault,
				applied,
				Preservation::Expendable,
				Precision::Exact,
				Fortitude::Force,
			)?;
			ensure!(burned == applied, Error::<T>::Arithmetic);

			TotalAssets::<T>::put(new_total);
			TotalSlashed::<T>::put(
				TotalSlashed::<T>::get().checked_add(&applied).ok_or(Error::<T>::Arithmetic)?,
			);

			Self::deposit_event(Event::Slashed { amount: applied, total_assets: new_total });
			Ok(applied)
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

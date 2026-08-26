//! Sink traits implemented by vaults (or runtime adapters) for Hub observation ingress.
use frame::prelude::{DispatchError, DispatchResult};

/// Nomination-path vault (oDOT): credit Hub nomination rewards into `V`.
pub trait NominationRewardSink {
	type Balance: frame::prelude::Member
		+ frame::prelude::Parameter
		+ frame::prelude::MaxEncodedLen
		+ Copy
		+ Default
		+ frame::traits::Zero;

	fn credit_nomination_rewards(amount: Self::Balance) -> DispatchResult;
}

/// Self-stake vault (eDOT): credit Hub self-stake rewards and apply Hub slash.
pub trait SelfStakeVaultSink {
	type Balance: frame::prelude::Member
		+ frame::prelude::Parameter
		+ frame::prelude::MaxEncodedLen
		+ Copy
		+ Default
		+ frame::traits::Zero;

	fn credit_self_stake_rewards(amount: Self::Balance) -> DispatchResult;

	/// Returns the amount actually applied (may be capped at slashable balance).
	fn apply_hub_slash(amount: Self::Balance) -> Result<Self::Balance, DispatchError>;
}

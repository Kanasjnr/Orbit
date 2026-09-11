//! Cross-vault read access for the eDOT mix circuit breaker.

/// Live oDOT (nomination-path) vault backing, read-only.
///
/// eDOT checks this before minting so self-stake capital never outgrows the
/// nomination capital backing it.
pub trait NominationBacking<Balance> {
	fn total_nomination_assets() -> Balance;
}

#!/usr/bin/env bash
# Local/CI lint entrypoint: cargo fmt --check + clippy, same flags either place.
set -euo pipefail

run_fmt() {
	cargo fmt --all -- --check
}

run_clippy() {
	SKIP_PALLET_REVIVE_FIXTURES=1 SKIP_WASM_BUILD=1 \
		cargo clippy --all-targets --locked --workspace -- -D warnings
}

case "${1:-all}" in
	fmt) run_fmt ;;
	clippy) run_clippy ;;
	all)
		run_fmt
		run_clippy
		;;
	*)
		echo "usage: $0 [fmt|clippy]" >&2
		exit 1
		;;
esac

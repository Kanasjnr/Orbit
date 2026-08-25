# Pin builder to Rust < 1.96 (wasm-ld --allow-undefined removal breaks
# Substrate host imports: ext_storage_* undefined symbol at link time).
FROM rust:1.93.1-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
	clang \
	libclang-dev \
	cmake \
	protobuf-compiler \
	pkg-config \
	libssl-dev \
	git \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /polkadot
COPY . /polkadot

RUN rustup target add wasm32-unknown-unknown && \
	rustup component add rust-src

RUN cargo fetch
RUN cargo build --workspace --locked --profile production

FROM docker.io/parity/base-bin:latest

COPY --from=builder /polkadot/target/production/parachain-template-node /usr/local/bin

USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /polkadot polkadot && \
	mkdir -p /data /polkadot/.local/share && \
	chown -R polkadot:polkadot /data && \
	ln -s /data /polkadot/.local/share/polkadot && \
	rm -rf /usr/bin /usr/sbin && \
	/usr/local/bin/parachain-template-node --version

USER polkadot

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/parachain-template-node"]

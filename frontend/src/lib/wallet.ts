import type { ApiPromise } from "@polkadot/api";
import { web3Accounts, web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import type { InjectedAccountWithMeta, MetadataDef } from "@polkadot/extension-inject/types";

const APP_NAME = "Orbit";

export async function connectWallet(): Promise<InjectedAccountWithMeta[]> {
  const extensions = await web3Enable(APP_NAME);
  if (extensions.length === 0) {
    throw new Error("No wallet extension found. Install Talisman or SubWallet.");
  }
  return web3Accounts();
}

export async function getSigner(address: string) {
  const injector = await web3FromAddress(address);
  return injector.signer;
}

function metadataDefFor(api: ApiPromise, userExtensions?: MetadataDef["userExtensions"]): MetadataDef {
  return {
    chain: api.runtimeChain.toString(),
    genesisHash: api.genesisHash.toHex(),
    icon: "substrate",
    ss58Format: api.registry.chainSS58 ?? 42,
    specVersion: api.runtimeVersion.specVersion.toNumber(),
    tokenDecimals: api.registry.chainDecimals[0] ?? 12,
    tokenSymbol: api.registry.chainTokens[0] ?? "UNIT",
    types: {},
    userExtensions,
  };
}

/**
 * Registers a chain's metadata with the account's wallet extension, so it can
 * decode and display extrinsics for that chain instead of refusing to sign
 * with "Unable to find metadata for chain ...". Safe to call repeatedly: a
 * one-time approval prompt on an unknown chain, a no-op once it's known.
 */
export async function provideChainMetadata(
  api: ApiPromise,
  address: string,
  userExtensions?: MetadataDef["userExtensions"],
): Promise<void> {
  const injector = await web3FromAddress(address);
  if (!injector.metadata) return;
  try {
    await injector.metadata.provide(metadataDefFor(api, userExtensions));
  } catch {
    // User declined, or the extension doesn't support it — signing will
    // surface its own error later if metadata really is required.
  }
}

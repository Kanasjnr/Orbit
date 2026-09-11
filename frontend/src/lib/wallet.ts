import { web3Accounts, web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";

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

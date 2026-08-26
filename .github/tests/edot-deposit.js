// Zombienet script: Alice deposits into the eDOT vault on the Orbit parachain (charlie RPC).
// Returns minted share balance (must be > 0).

const MILLI_UNIT = 1_000_000_000n;

async function run(nodeName, networkInfo, _jsArgs) {
	const { wsUri, userDefinedTypes } = networkInfo.nodesByName[nodeName];
	const api = await zombie.connect(wsUri, userDefinedTypes);

	await zombie.util.cryptoWaitReady();

	const keyring = new zombie.Keyring({ type: "sr25519" });
	const alice = keyring.addFromUri("//Alice");

	// MinimumDeposit = 10 * MILLI_UNIT in runtime config.
	const depositAmount = 100n * MILLI_UNIT;

	await new Promise((resolve, reject) => {
		api.tx.edot
			.deposit(depositAmount)
			.signAndSend(alice, (result) => {
				if (result.status.isFinalized) {
					resolve();
				} else if (result.isError) {
					reject(new Error("edot.deposit failed"));
				}
			})
			.catch(reject);
	});

	const shares = await api.query.edot.shares(alice.address);
	return Number(BigInt(shares.toString()));
}

module.exports = { run };

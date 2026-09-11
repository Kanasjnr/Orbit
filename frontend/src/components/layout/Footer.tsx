import { GitFork } from "lucide-react";

const REPO_URL = "https://github.com/Kanasjnr/Orbit";

const links = [
  { label: "Whitepaper", href: `${REPO_URL}/blob/main/WHITEPAPER.md` },
  { label: "Source", href: REPO_URL },
  { label: "How it works", href: "#how-it-works" },
];

export function Footer() {
  return (
    <footer className="mt-[100px] border-t bg-[#12132b] text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p
            className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-2xl text-transparent"
            style={{ fontFamily: "Gotham", fontWeight: 350 }}
          >
            Orbit
          </p>
          <p className="mt-2 text-base text-slate-400" style={{ fontFamily: "Gotham", fontWeight: 325 }}>
            Liquid staking for Polkadot after the reward split: oDOT for nomination, eDOT for validator
            self-stake.
          </p>
          <a
            href={REPO_URL}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-600 px-3 py-2 text-base text-slate-300 hover:border-slate-400"
            style={{ fontFamily: "Gotham", fontWeight: 325 }}
          >
            <GitFork className="size-4" />
            Source on GitHub
          </a>
        </div>

        <div>
          <h4 className="text-base font-semibold text-white" style={{ fontFamily: "Gotham", fontWeight: 500 }}>
            Resources
          </h4>
          <ul className="mt-3 space-y-2 text-base">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-slate-400 hover:text-white"
                  style={{ fontFamily: "Gotham", fontWeight: 325 }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="border-t border-slate-800 px-4 py-4 text-center text-sm text-slate-500 sm:px-6"
        style={{ fontFamily: "Gotham", fontWeight: 325 }}
      >
        FRAME parachain scaffold. Not audited. Not mainnet. Do not deposit real DOT.
      </div>
    </footer>
  );
}

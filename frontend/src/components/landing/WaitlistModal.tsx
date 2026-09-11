import { useEffect, useState } from "react";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const pitchPoints = [
  {
    title: "Two-token liquid staking",
    body: "oDOT for safe nomination yield, eDOT for Polkadot's new self-stake incentive layer — pick one or split across both.",
  },
  {
    title: "No lockups",
    body: "Redeem instantly from the buffer, or queue a full protocol exit. Either way, you're never stuck waiting on unbonding.",
  },
  {
    title: "Built on Polkadot Hub",
    body: "A FRAME parachain talking directly to Hub staking extrinsics. No bridges, no wrapped assets.",
  },
];

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and email are both required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    // No backend wired yet — swap in whichever provider gets picked later.
    setSubmitted(true);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm md:max-w-4xl max-h-[90vh] md:h-auto">
        <div className="flex items-center justify-end p-4 md:p-6">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full md:flex md:min-h-[520px]">
          {/* Left - protocol pitch (hidden on mobile) */}
          <div className="hidden md:flex md:w-1/2 p-6 lg:p-12">
            <div className="flex flex-col max-w-md">
              <h3
                className="text-2xl lg:text-3xl mb-8"
                style={{ fontFamily: "Gotham", fontWeight: 700, color: "#1C1C1C" }}
              >
                Liquid Staking Protocol.
              </h3>
              <div className="space-y-6 lg:space-y-8">
                {pitchPoints.map((point) => (
                  <div key={point.title} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#00D2FF] to-[#7C3AED]" />
                    </div>
                    <div>
                      <h4 className="mb-2 text-lg" style={{ fontFamily: "Gotham", fontWeight: 350, color: "#1C1C1C" }}>
                        {point.title}
                      </h4>
                      <p className="text-sm" style={{ fontFamily: "Gotham", fontWeight: 325, color: "#1C1C1C80" }}>
                        {point.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px bg-gray-200 self-stretch" />

          {/* Right - waitlist form */}
          <div className="flex flex-col md:justify-center items-center w-full md:w-1/2 p-6 pb-8 lg:p-12">
            <div className="w-full max-w-sm flex flex-col items-center space-y-4 md:space-y-6">
              {submitted ? (
                <div className="text-center">
                  <h3 className="mb-2 text-xl md:text-2xl" style={{ fontFamily: "Gotham", fontWeight: 600, color: "#1C1C1C" }}>
                    You&apos;re on the list
                  </h3>
                  <p className="text-sm md:text-base text-gray-500">We&apos;ll be in touch when Orbit opens up.</p>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <h3
                      className="mb-3 text-xl md:text-2xl lg:text-3xl"
                      style={{ fontFamily: "Gotham", fontWeight: 600, color: "#1C1C1C" }}
                    >
                      Join our journey and get early access
                    </h3>
                    <p className="text-sm md:text-base text-gray-500">
                      Join the waitlist to get notified when Orbit opens up.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="w-full flex flex-col items-center space-y-3 md:space-y-4">
                    <div className="w-full flex flex-col space-y-2 md:space-y-3">
                      <input
                        type="text"
                        placeholder="Tell us your name..."
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        className="w-full h-11 md:h-12 px-4 py-3 rounded-lg border-[1.7px] bg-[#7C3AED1A] border-[#7C3AED1A] focus:ring-0 focus:border-[#7C3AED] focus:outline-none transition-all duration-200 text-sm md:text-base"
                        style={{ fontFamily: "Gotham", color: "#1C1C1C" }}
                      />
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        className="w-full h-11 md:h-12 px-4 py-3 rounded-lg border-[1.7px] bg-[#7C3AED1A] border-[#7C3AED1A] focus:ring-0 focus:border-[#7C3AED] focus:outline-none transition-all duration-200 text-sm md:text-base"
                        style={{ fontFamily: "Gotham", color: "#1C1C1C" }}
                      />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                      type="submit"
                      className="w-full h-11 md:h-12 text-white font-semibold text-sm md:text-base rounded-lg transition-all duration-300 hover:shadow-lg"
                      style={{ background: "#7C3AED", fontFamily: "Gotham", fontWeight: 600 }}
                    >
                      Join waitlist
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

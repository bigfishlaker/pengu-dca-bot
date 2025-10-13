import { PenguDCABot } from "@/components/pengu-dca-bot";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 relative overflow-hidden">
      {/* Subtle background patterns - calm by default */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-5 left-5 w-16 h-16 rounded-full bg-pink-400/40 blur-lg" />
        <div className="absolute top-20 right-10 w-20 h-20 rounded-full bg-purple-400/40 blur-lg" />
        <div className="absolute top-40 left-40 w-12 h-12 rounded-full bg-blue-400/40 blur-md" />
        <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-pink-400/40 blur-xl" />
        <div className="absolute bottom-32 right-32 w-16 h-16 rounded-full bg-purple-400/40 blur-lg" />
        <div className="absolute top-60 right-60 w-20 h-20 rounded-full bg-blue-400/40 blur-md" />
      </div>

      {/* Sparkles decoration - static until celebration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-20 text-3xl">⭐</div>
        <div className="absolute top-20 right-20 text-2xl">✨</div>
        <div className="absolute top-40 left-60 text-4xl">💫</div>
        <div className="absolute bottom-20 right-40 text-3xl">⭐</div>
        <div className="absolute bottom-40 left-40 text-2xl">✨</div>
        <div className="absolute top-80 right-80 text-3xl">💫</div>
        <div className="absolute top-1/2 left-10 text-4xl">🌸</div>
        <div className="absolute top-1/3 right-10 text-3xl">💕</div>
        <div className="absolute bottom-1/3 left-1/4 text-2xl">🎀</div>
      </div>

      {/* Header with wallet button and donation */}
      <div className="fixed top-2 right-2 z-50 flex gap-2">
        {/* Donation Link */}
        <a
          href="https://portal.abs.xyz/profile/0xe77c0bA7f9Ef40A018B48Ce37731195726254Df7"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-full border-3 border-pink-400 bg-white hover:bg-pink-50 transition-all hover:scale-105 shadow-lg flex items-center gap-2 font-black text-sm"
        >
          <span className="text-xl">💕</span>
          <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Donate
          </span>
        </a>
        <ConnectWalletButton />
      </div>

      {/* Main DCA Bot */}
      <div className="relative pt-4 pb-4 z-10">
        <PenguDCABot />
      </div>
    </main>
  );
}


import { PenguDCABot } from "@/components/pengu-dca-bot";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold tracking-tight">PENGU</span>
            <span className="text-slate-500 text-sm">DCA Bot</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://portal.abs.xyz/profile/0xe77c0bA7f9Ef40A018B48Ce37731195726254Df7"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Support
            </a>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative pt-20 pb-8 z-10">
        <PenguDCABot />
      </div>
    </main>
  );
}

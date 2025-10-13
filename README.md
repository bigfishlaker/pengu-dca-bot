# Abstract Buy Bot

A Next.js application built on the Abstract blockchain with AGW (Abstract Global Wallet) integration.

## What's Included

This project has been initialized with:

- **Next.js 15.5.4** with TypeScript and App Router
- **Tailwind CSS** for styling
- **shadcn/ui** component library (New York style)
- **Abstract Global Wallet (AGW)** integration for wallet connectivity
- **Abstract Contracts** configuration with common contract addresses and ABIs
- **Viem** for blockchain interactions with ZKSync extensions
- **Wagmi** for React hooks
- **TanStack Query** for data fetching and caching

## Project Structure

```
├── app/
│   ├── globals.css          # Global styles with Tailwind
│   ├── layout.tsx            # Root layout with AGW Provider
│   └── page.tsx              # Home page
├── components/
│   ├── agw-provider.tsx      # Abstract Wallet Provider wrapper
│   └── ui/
│       └── sonner.tsx        # Toast notifications
├── config/
│   ├── abstract-contracts.ts # Contract addresses and ABIs (WETH, USDC, USDT, Uniswap)
│   ├── chain.ts              # Network configuration (testnet/mainnet)
│   └── viem-clients.ts       # Viem client instances
├── lib/
│   ├── chain-utils.ts        # Utility functions for contracts
│   └── utils.ts              # General utilities (cn helper)
└── types/
    └── contracts.ts          # TypeScript types for contracts

```

## Available Contracts

The project includes pre-configured contracts for Abstract blockchain:

### Tokens
- **WETH** (Wrapped Ether)
- **USDC** (USD Coin)  
- **USDT** (Tether USD)

### DEX Protocols
- **Uniswap V2** (Factory, Router)
- **Uniswap V3** (Factory, QuoterV2, SwapRouter02)

All contracts include both mainnet and testnet addresses where available.

## Getting Started

1. **Install dependencies** (if not already installed):
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## Environment Configuration

The project is configured to use **Abstract Mainnet**. The chain configuration is set in `config/chain.ts`:

```typescript
import { abstract } from "viem/chains";

export const chain = abstract; // Mainnet
```

## Using Contracts

Import and use contracts in your components:

```typescript
import { ABSTRACT_CONTRACTS } from "@/config/abstract-contracts";
import { getContractWithCurrentChain } from "@/lib/chain-utils";

// Get WETH contract with current chain
const wethContract = getContractWithCurrentChain("weth");

// Access contract details
console.log(wethContract.address); // Contract address
console.log(wethContract.abi);     // Contract ABI
```

## Adding More Components

Add shadcn/ui components:
```bash
npx shadcn@latest add [component-name]
```

Add AGW Reusables components:
```bash
npx shadcn@latest add "https://build.abs.xyz/r/[component-name].json"
```

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Abstract Documentation](https://docs.abs.xyz)
- [AGW Reusables](https://build.abs.xyz)
- [shadcn/ui](https://ui.shadcn.com)
- [Viem Documentation](https://viem.sh)

## Build for Production

```bash
npm run build
npm run start
```

## Notes

- This project uses `--legacy-peer-deps` for npm installations due to peer dependency conflicts between packages
- The Abstract Global Wallet provider wraps the entire application for wallet connectivity
- Viem clients are configured with ZKSync extensions for Abstract compatibility



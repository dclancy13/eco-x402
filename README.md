# @eco/x402

Drop-in Express middleware for API monetization with instant USDC payments.

**One line of code to monetize your API.**

```typescript
import { x402 } from '@eco/x402';

app.use('/api/premium', x402({
  recipient: '0xYourWallet',
  price: '0.01',  // $0.01 per request
}));
```

## Features

- **Zero friction** - Payments settle in ~2 seconds on Base
- **AI agent ready** - Works with any x402-compatible client
- **Gasless for users** - Uses EIP-3009 transferWithAuthorization
- **Flexible pricing** - Set different prices for different routes
- **Callbacks** - Get notified on successful payments

## Installation

```bash
npm install @eco/x402
```

## Quick Start

### 1. Basic Usage

Protect all routes under a path with the same price:

```typescript
import express from 'express';
import { x402 } from '@eco/x402';

const app = express();

// All requests to /api/premium/* require $0.01 payment
app.use('/api/premium', x402({
  recipient: '0xYourWalletAddress',
  price: '0.01',
}));

app.get('/api/premium/data', (req, res) => {
  res.json({ secret: 'Paid content!' });
});

app.listen(3000);
```

### 2. Different Prices per Route

```typescript
app.use(x402({
  recipient: '0xYourWalletAddress',
  routes: [
    { path: '/api/weather', price: '0.001' },
    { path: '/api/ai/*', price: '0.05' },
    { path: '/api/premium/*', price: '0.01' },
  ],
}));
```

### 3. With Callbacks

```typescript
app.use('/api/premium', x402({
  recipient: '0xYourWalletAddress',
  price: '0.01',
  onPayment: (receipt) => {
    console.log(`Received $${receipt.amount} from ${receipt.payer}`);
    console.log(`Transaction: ${receipt.transactionHash}`);
  },
  onError: (error) => {
    console.error(`Payment failed: ${error.message}`);
  },
}));
```

## Try the Demo

Test the full x402 payment flow locally without real USDC:

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/eco-x402.git
cd eco-x402
npm install
```

### 2. Start the Mock Facilitator (Terminal 1)

```bash
npm run demo:facilitator
```

This starts a local facilitator on port 4020 that approves all payments.

### 3. Start the Demo Server (Terminal 2)

```bash
npm run demo:server
```

This starts an API server on port 3000 with free and paid endpoints.

### 4. Run the Test Client (Terminal 3)

```bash
npm run demo:client
```

This demonstrates the complete payment flow:
1. Request paid endpoint → receive 402 Payment Required
2. Parse payment requirements from response header
3. Create signed payment authorization
4. Retry request with payment → receive content

### Manual Testing with curl

```bash
# Free endpoint
curl http://localhost:3000/api/public

# Paid endpoint (returns 402 with payment requirements)
curl -i http://localhost:3000/api/premium/joke
```

## Demo vs Production

| Component | Demo Mode | Production |
|-----------|-----------|------------|
| **Facilitator** | Mock (localhost:4020) | Coinbase at `https://x402.org/facilitator` |
| **Wallet signing** | Fake signatures | Real wallet (MetaMask, WalletConnect) |
| **Network** | Simulated | Base mainnet with real USDC |
| **Settlement** | Instant approval | On-chain USDC transfer (~2 sec) |

### Production Setup

To go live, simply point to the real Coinbase facilitator:

```typescript
import { x402 } from '@eco/x402';

app.use('/api/premium', x402({
  recipient: '0xYourRealWallet',  // Your wallet to receive USDC
  price: '0.01',
  // No facilitator config needed - defaults to Coinbase production
}));
```

Or explicitly configure:

```typescript
app.use('/api/premium', x402({
  recipient: '0xYourRealWallet',
  price: '0.01',
  facilitator: {
    url: 'https://x402.org/facilitator',
  },
  network: 'eip155:8453',  // Base mainnet (default)
}));
```

## How It Works

1. Client requests a protected endpoint
2. Server returns `HTTP 402 Payment Required` with payment details
3. Client signs a USDC transfer authorization (gasless!)
4. Client retries the request with payment in `X-PAYMENT` header
5. Server verifies and settles the payment on-chain
6. Server returns the requested resource

```
Client                    Server                    Facilitator
  │                         │                          │
  │─── GET /api/data ──────▶│                          │
  │                         │                          │
  │◀── 402 Payment Required │                          │
  │    + x-payment-required │                          │
  │                         │                          │
  │─── GET /api/data ──────▶│                          │
  │    + x-payment header   │                          │
  │                         │─── POST /settle ────────▶│
  │                         │    (verify & execute)    │
  │                         │◀── {success, txHash} ────│
  │◀── 200 OK + data ───────│                          │
  │    + x-payment-response │                          │
```

## Configuration

### X402Config

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `recipient` | `string` | Yes | Wallet address to receive payments |
| `price` | `string` | * | Price in USD (e.g., '0.01') |
| `routes` | `RouteConfig[]` | * | Route-specific pricing |
| `description` | `string` | No | Description for payment requirements |
| `network` | `string` | No | CAIP-2 chain ID (default: Base mainnet) |
| `facilitator` | `FacilitatorConfig` | No | Custom facilitator (default: Coinbase) |
| `onPayment` | `function` | No | Callback on successful payment |
| `onError` | `function` | No | Callback on payment failure |

\* Either `price` or `routes` must be specified

### RouteConfig

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `path` | `string` | Yes | Express route pattern |
| `price` | `string` | Yes | Price in USD |
| `description` | `string` | No | Description |
| `methods` | `string[]` | No | HTTP methods (default: all) |

### FacilitatorConfig

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `url` | `string` | Yes | Facilitator base URL |
| `apiKey` | `string` | No | Optional API key |
| `timeout` | `number` | No | Request timeout in ms (default: 30000) |

## Supported Networks

| Network | Chain ID | USDC Address |
|---------|----------|--------------|
| Base Mainnet | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Polygon | `eip155:137` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Ethereum | `eip155:1` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Arbitrum | `eip155:42161` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Optimism | `eip155:10` | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |

## Payment Receipt

After successful payment, the receipt is attached to `req.paymentReceipt`:

```typescript
app.get('/api/premium/data', (req, res) => {
  const receipt = req.paymentReceipt;
  console.log(`Paid by: ${receipt.payer}`);
  console.log(`Amount: $${receipt.amount}`);
  console.log(`Tx: ${receipt.transactionHash}`);

  res.json({ data: 'Premium content' });
});
```

## x402 Protocol Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `x-payment-required` | Response (402) | Base64 JSON with payment requirements |
| `x-payment` | Request | Base64 JSON with signed payment authorization |
| `x-payment-response` | Response (200) | Base64 JSON with settlement confirmation |

## Client Libraries

To build a client that can pay for x402-protected APIs:

### JavaScript/TypeScript
```typescript
// Example using the x402 fetch wrapper
import { wrapFetchWithPayment } from '@x402/fetch';

const paymentFetch = wrapFetchWithPayment({ wallet });
const response = await paymentFetch('https://api.example.com/premium/data');
```

### Python
```python
from x402 import create_payment_session

session = create_payment_session(wallet)
response = session.get('https://api.example.com/premium/data')
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run demo
npm run demo:facilitator  # Terminal 1
npm run demo:server       # Terminal 2
npm run demo:client       # Terminal 3
```

## License

MIT

## Links

- [x402 Protocol Specification](https://x402.org)
- [Eco Network](https://eco.com)

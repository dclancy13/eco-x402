# @eco/x402 Demo

Test the x402 middleware locally without real USDC!

## Quick Start

### 1. Install Dependencies

```bash
cd eco-x402
npm install
npm run build
```

### 2. Start the Mock Facilitator (Terminal 1)

```bash
npx ts-node demo/mock-facilitator.ts
```

This starts a local facilitator on port 4020 that approves all payments.

### 3. Start the Demo Server (Terminal 2)

```bash
npx ts-node demo/demo-server.ts
```

This starts the API server on port 3000 with:
- Free endpoints: `/`, `/health`, `/api/public`
- Paid endpoints: `/api/premium/joke`, `/api/premium/fortune`, `/api/ai/generate`

### 4. Run the Test Client (Terminal 3)

```bash
npx ts-node demo/test-client.ts
```

This demonstrates the complete payment flow.

## Manual Testing with curl

### Test Free Endpoint

```bash
curl http://localhost:3000/api/public
```

### Test Paid Endpoint (Get 402)

```bash
curl -i http://localhost:3000/api/premium/joke
```

You'll see:
- `HTTP/1.1 402 Payment Required`
- `x-payment-required` header with Base64-encoded payment requirements

### Decode Payment Requirements

```bash
# Get the x-payment-required header value and decode it
curl -s http://localhost:3000/api/premium/joke | jq '.requirements'
```

## Payment Flow Diagram

```
┌─────────┐        ┌─────────────┐        ┌────────────┐
│  Client │        │ Demo Server │        │ Facilitator│
└────┬────┘        └──────┬──────┘        └─────┬──────┘
     │                    │                      │
     │  GET /api/joke     │                      │
     │───────────────────>│                      │
     │                    │                      │
     │  402 + Requirements│                      │
     │<───────────────────│                      │
     │                    │                      │
     │  GET /api/joke     │                      │
     │  + X-Payment header│                      │
     │───────────────────>│                      │
     │                    │    POST /settle      │
     │                    │─────────────────────>│
     │                    │                      │
     │                    │   {success: true}    │
     │                    │<─────────────────────│
     │                    │                      │
     │   200 + Content    │                      │
     │<───────────────────│                      │
     │                    │                      │
```

## Files

| File | Description |
|------|-------------|
| `mock-facilitator.ts` | Local facilitator that approves all payments |
| `demo-server.ts` | Express server with free and paid endpoints |
| `test-client.ts` | Client that demonstrates the full payment flow |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Demo server port |
| `FACILITATOR_PORT` | 4020 | Mock facilitator port |
| `FACILITATOR_URL` | http://localhost:4020 | Facilitator URL for demo server |
| `SERVER_URL` | http://localhost:3000 | Server URL for test client |

## What's Happening

1. **Client requests protected endpoint** → Server returns 402 with payment requirements
2. **Client creates payment** → Signs a transfer authorization (mocked in demo)
3. **Client retries with payment** → Includes `X-Payment` header
4. **Server validates payment** → Sends to facilitator for settlement
5. **Facilitator settles on-chain** → Returns transaction hash (mocked in demo)
6. **Server returns content** → Client receives the protected data

## Pricing in Demo

| Endpoint | Price |
|----------|-------|
| `/api/premium/joke` | $0.001 |
| `/api/premium/fortune` | $0.005 |
| `/api/ai/generate` | $0.010 |
| `/api/ai/analyze` | $0.020 |

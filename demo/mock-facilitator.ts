/**
 * Mock Facilitator Server
 *
 * A local facilitator that approves all payments for testing purposes.
 * Simulates the Coinbase x402 facilitator without requiring real USDC.
 *
 * Run with: npx ts-node demo/mock-facilitator.ts
 */

import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.FACILITATOR_PORT || 4020;

// Track "settled" payments for verification
const settledPayments = new Map<string, {
  txHash: string;
  payer: string;
  amount: string;
  timestamp: number;
}>();

/**
 * POST /verify
 * Verify a payment payload is valid
 */
app.post('/verify', (req: Request, res: Response) => {
  console.log('[Mock Facilitator] Verify request received');

  const { paymentPayload: payload, paymentRequirements: requirements } = req.body;

  if (!payload || !requirements) {
    res.status(400).json({
      valid: false,
      error: 'Missing payload or requirements',
    });
    return;
  }

  // In mock mode, all structurally valid payments are "valid"
  try {
    const auth = payload.payload?.authorization;
    if (!auth) {
      res.status(400).json({
        valid: false,
        error: 'Missing authorization in payload',
      });
      return;
    }

    console.log(`[Mock Facilitator] ✓ Payment verified: ${auth.value} from ${auth.from}`);

    res.json({
      valid: true,
      payer: auth.from,
      amount: auth.value,
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: 'Invalid payload structure',
    });
  }
});

/**
 * POST /settle
 * Settle a payment on-chain (mock: instantly approve)
 */
app.post('/settle', (req: Request, res: Response) => {
  console.log('[Mock Facilitator] Settle request received');

  const { paymentPayload: payload, paymentRequirements: requirements } = req.body;

  if (!payload || !requirements) {
    res.status(400).json({
      success: false,
      errorReason: 'Missing payload or requirements',
    });
    return;
  }

  try {
    const auth = payload.payload?.authorization;
    if (!auth) {
      res.status(400).json({
        success: false,
        errorReason: 'Missing authorization in payload',
      });
      return;
    }

    // Generate mock transaction hash
    const txHash = `0x${generateMockTxHash()}`;
    const timestamp = Date.now();

    // Store for later verification
    settledPayments.set(auth.nonce, {
      txHash,
      payer: auth.from,
      amount: auth.value,
      timestamp,
    });

    console.log(`[Mock Facilitator] ✓ Payment settled!`);
    console.log(`  Payer: ${auth.from}`);
    console.log(`  Amount: ${auth.value} (${formatUSDC(auth.value)})`);
    console.log(`  TX Hash: ${txHash}`);

    res.json({
      success: true,
      transaction: txHash,
      payer: auth.from,
      timestamp,
      network: payload.network,
    });
  } catch (error) {
    console.error('[Mock Facilitator] Settlement error:', error);
    res.status(500).json({
      success: false,
      errorReason: 'Internal facilitator error',
    });
  }
});

/**
 * GET /status/:txHash
 * Check status of a settled payment
 */
app.get('/status/:txHash', (req: Request, res: Response) => {
  const { txHash } = req.params;

  // Find by txHash
  const entries = Array.from(settledPayments.entries());
  for (let i = 0; i < entries.length; i++) {
    const [, payment] = entries[i];
    if (payment.txHash === txHash) {
      res.json({
        found: true,
        status: 'confirmed',
        ...payment,
      });
      return;
    }
  }

  res.json({
    found: false,
    status: 'not_found',
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: 'mock',
    settledCount: settledPayments.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /
 * Info endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: '@eco/x402 Mock Facilitator',
    version: '1.0.0',
    mode: 'development',
    endpoints: {
      'POST /verify': 'Verify a payment payload',
      'POST /settle': 'Settle a payment (mock)',
      'GET /status/:txHash': 'Check payment status',
      'GET /health': 'Health check',
    },
    note: 'This facilitator approves ALL payments for testing purposes. Do not use in production!',
  });
});

// Helper functions
function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function formatUSDC(baseUnits: string): string {
  const units = BigInt(baseUnits);
  const dollars = Number(units) / 1_000_000;
  return `$${dollars.toFixed(6)} USDC`;
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              @eco/x402 Mock Facilitator                        ║
╠════════════════════════════════════════════════════════════════╣
║  Running at: http://localhost:${PORT}                             ║
║  Mode: DEVELOPMENT (all payments approved)                     ║
╠════════════════════════════════════════════════════════════════╣
║  ⚠️  WARNING: This is for testing only!                         ║
║  Do not use this facilitator in production.                    ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

export { app };

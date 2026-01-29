/**
 * Demo Server for @eco/x402
 *
 * A complete example server with protected and free endpoints.
 * Uses the mock facilitator for local testing.
 *
 * Run with: npx ts-node demo/demo-server.ts
 */

import express, { Request, Response } from 'express';
import { x402 } from '../src/index.js';
import type { FacilitatorConfig } from '../src/types/index.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:4020';
const FACILITATOR: FacilitatorConfig = { url: FACILITATOR_URL };

// Demo recipient wallet (use any address for testing)
const RECIPIENT = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth for demo

console.log(`[Demo Server] Using facilitator at: ${FACILITATOR_URL}`);

// ============================================================================
// FREE ENDPOINTS (no payment required)
// ============================================================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: '@eco/x402 Demo Server',
    version: '1.0.0',
    endpoints: {
      free: [
        'GET / - This info page',
        'GET /health - Health check',
        'GET /api/public - Free public data',
      ],
      paid: [
        'GET /api/premium/joke - $0.001 - Get a random joke',
        'GET /api/premium/fortune - $0.005 - Get your fortune',
        'POST /api/ai/generate - $0.01 - AI text generation',
      ],
    },
    testing: {
      step1: 'Start the mock facilitator: npx ts-node demo/mock-facilitator.ts',
      step2: 'Start this server: npx ts-node demo/demo-server.ts',
      step3: 'Use the test client: npx ts-node demo/test-client.ts',
    },
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    facilitator: FACILITATOR,
  });
});

app.get('/api/public', (_req: Request, res: Response) => {
  res.json({
    message: 'This endpoint is free!',
    data: {
      randomNumber: Math.floor(Math.random() * 100),
      timestamp: Date.now(),
    },
    hint: 'Try /api/premium/joke for paid content (requires payment)',
  });
});

// ============================================================================
// PREMIUM ENDPOINTS (x402 protected)
// ============================================================================

// Apply x402 middleware to /api/premium/*
app.use(
  '/api/premium',
  x402({
    recipient: RECIPIENT,
    price: '0.001', // Default price for premium endpoints
    description: 'Premium API access',
    facilitator: FACILITATOR,
    onPayment: (receipt) => {
      console.log(`\n💰 [Payment Received]`);
      console.log(`   Amount: $${receipt.amount}`);
      console.log(`   Payer: ${receipt.payer}`);
      console.log(`   Resource: ${receipt.resource}`);
      console.log(`   TX: ${receipt.transactionHash}\n`);
    },
    onError: (error) => {
      console.error(`\n❌ [Payment Error] ${error.code}: ${error.message}\n`);
    },
  })
);

// Premium joke endpoint
const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "Why did the developer go broke? Because he used up all his cache!",
  "There are only 10 types of people: those who understand binary and those who don't.",
  "Why do Java developers wear glasses? Because they don't C#!",
];

app.get('/api/premium/joke', (req: Request, res: Response) => {
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  res.json({
    joke,
    paid: true,
    paidBy: (req as Request & { paymentReceipt?: { payer: string } }).paymentReceipt?.payer,
  });
});

// Premium fortune endpoint with custom pricing
app.use(
  '/api/premium/fortune',
  x402({
    recipient: RECIPIENT,
    price: '0.005', // $0.005 for fortune
    description: 'Premium fortune telling',
    facilitator: FACILITATOR,
  })
);

const fortunes = [
  "A beautiful, smart, and loving person will enter your life.",
  "Your code will compile on the first try today.",
  "Someone will appreciate your pull request.",
  "A new opportunity disguised as a bug report awaits you.",
  "The stars say you should deploy on Friday. (Just kidding, don't do that.)",
];

app.get('/api/premium/fortune', (req: Request, res: Response) => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  res.json({
    fortune,
    luckyNumbers: [7, 13, 21, 42, 69],
    paid: true,
    paidBy: (req as Request & { paymentReceipt?: { payer: string } }).paymentReceipt?.payer,
  });
});

// ============================================================================
// AI ENDPOINTS (higher priced)
// ============================================================================

app.use(
  '/api/ai',
  x402({
    recipient: RECIPIENT,
    routes: [
      { path: '/api/ai/generate', price: '0.01', methods: ['POST'] },
      { path: '/api/ai/analyze', price: '0.02', methods: ['POST'] },
    ],
    facilitator: FACILITATOR,
    onPayment: (receipt) => {
      console.log(`\n🤖 [AI Payment] $${receipt.amount} for ${receipt.resource}\n`);
    },
  })
);

app.post('/api/ai/generate', (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };

  // Simulate AI generation
  const responses = [
    `Here's a creative response to "${prompt || 'your prompt'}": The quantum flux capacitor indicates optimal synergy.`,
    `Analyzing "${prompt || 'your request'}"... I recommend leveraging blockchain-enabled machine learning paradigms.`,
    `Based on my neural networks, "${prompt || 'this'}" suggests you should pivot to web3.`,
  ];

  res.json({
    generated: responses[Math.floor(Math.random() * responses.length)],
    model: 'mock-gpt-4',
    tokens: Math.floor(Math.random() * 100) + 50,
    paid: true,
  });
});

app.post('/api/ai/analyze', (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };

  res.json({
    analysis: {
      sentiment: Math.random() > 0.5 ? 'positive' : 'neutral',
      confidence: (Math.random() * 0.3 + 0.7).toFixed(2),
      wordCount: (text || '').split(' ').filter(Boolean).length,
      topics: ['technology', 'innovation', 'testing'],
    },
    paid: true,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  @eco/x402 Demo Server                         ║
╠════════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                              ║
║  Facilitator: ${FACILITATOR_URL.padEnd(35)}        ║
║  Recipient:  ${RECIPIENT.slice(0, 10)}...${RECIPIENT.slice(-6)}                        ║
╠════════════════════════════════════════════════════════════════╣
║  Free Endpoints:                                               ║
║    GET  /                  - API info                          ║
║    GET  /health            - Health check                      ║
║    GET  /api/public        - Free data                         ║
╠════════════════════════════════════════════════════════════════╣
║  Paid Endpoints:                                               ║
║    GET  /api/premium/joke    - $0.001                          ║
║    GET  /api/premium/fortune - $0.005                          ║
║    POST /api/ai/generate     - $0.010                          ║
║    POST /api/ai/analyze      - $0.020                          ║
╚════════════════════════════════════════════════════════════════╝

Try:
  curl http://localhost:${PORT}/api/public       (free)
  curl http://localhost:${PORT}/api/premium/joke (requires payment - returns 402)
  `);
});

export { app };

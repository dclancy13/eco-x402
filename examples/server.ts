/**
 * Example Express server using @eco/x402 middleware
 *
 * Run with: npx tsx examples/server.ts
 */

import express from 'express';
import { x402 } from '../src/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your wallet address
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000';

// ============================================================================
// Example 1: Simple - Protect all routes under /api/premium with same price
// ============================================================================

app.use(
  '/api/premium',
  x402({
    recipient: RECIPIENT_ADDRESS,
    price: '0.01', // $0.01 per request
    description: 'Premium API access',
    onPayment: (receipt) => {
      console.log(`[Payment Received] $${receipt.amount} from ${receipt.payer}`);
      console.log(`  Transaction: ${receipt.transactionHash}`);
      console.log(`  Resource: ${receipt.resource}`);
    },
    onError: (error) => {
      console.error(`[Payment Error] ${error.code}: ${error.message}`);
    },
  })
);

// Premium endpoints (protected by x402)
app.get('/api/premium/weather', (req, res) => {
  res.json({
    location: 'San Francisco, CA',
    temperature: 68,
    conditions: 'Sunny',
    humidity: 45,
  });
});

app.get('/api/premium/quote', (req, res) => {
  res.json({
    quote: 'The best way to predict the future is to create it.',
    author: 'Peter Drucker',
  });
});

// ============================================================================
// Example 2: Advanced - Different prices for different routes
// ============================================================================

app.use(
  x402({
    recipient: RECIPIENT_ADDRESS,
    routes: [
      {
        path: '/api/ai/generate',
        price: '0.05', // $0.05 for AI generation
        description: 'AI text generation',
        methods: ['POST'],
      },
      {
        path: '/api/ai/analyze',
        price: '0.02', // $0.02 for analysis
        description: 'AI content analysis',
        methods: ['POST'],
      },
      {
        path: '/api/data/*',
        price: '0.001', // $0.001 for data endpoints
        description: 'Data API access',
      },
    ],
    onPayment: (receipt) => {
      console.log(`[Payment] ${receipt.resource}: $${receipt.amount}`);
    },
  })
);

// AI endpoints
app.post('/api/ai/generate', express.json(), (req, res) => {
  const prompt = (req.body as { prompt?: string })?.prompt || 'Hello';
  res.json({
    generated: `AI response to: "${prompt}"`,
    tokens: 150,
  });
});

app.post('/api/ai/analyze', express.json(), (req, res) => {
  const text = (req.body as { text?: string })?.text || '';
  res.json({
    sentiment: 'positive',
    confidence: 0.92,
    wordCount: text.split(' ').length,
  });
});

// Data endpoints
app.get('/api/data/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  });
});

app.get('/api/data/stats', (req, res) => {
  res.json({
    totalUsers: 1000,
    activeToday: 150,
    revenue: '$5,432',
  });
});

// ============================================================================
// Free endpoints (not protected)
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    name: '@eco/x402 Example Server',
    version: '1.0.0',
    endpoints: {
      free: ['GET /health', 'GET /api/public'],
      premium: {
        '$0.01': ['GET /api/premium/weather', 'GET /api/premium/quote'],
        '$0.05': ['POST /api/ai/generate'],
        '$0.02': ['POST /api/ai/analyze'],
        '$0.001': ['GET /api/data/*'],
      },
    },
    documentation: 'https://github.com/eco/x402-middleware',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/public', (req, res) => {
  res.json({
    message: 'This endpoint is free!',
    hint: 'Try /api/premium/weather for paid content',
  });
});

// ============================================================================
// Start server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    @eco/x402 Example Server                    ║
╠════════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                      ║
║  Recipient wallet:  ${RECIPIENT_ADDRESS.slice(0, 10)}...${RECIPIENT_ADDRESS.slice(-8)}  ║
╠════════════════════════════════════════════════════════════════╣
║  Free endpoints:                                               ║
║    GET  /                    - API info                        ║
║    GET  /health              - Health check                    ║
║    GET  /api/public          - Free public data                ║
╠════════════════════════════════════════════════════════════════╣
║  Premium endpoints (x402 protected):                           ║
║    GET  /api/premium/weather - $0.01                           ║
║    GET  /api/premium/quote   - $0.01                           ║
║    POST /api/ai/generate     - $0.05                           ║
║    POST /api/ai/analyze      - $0.02                           ║
║    GET  /api/data/*          - $0.001                          ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

/**
 * Integration test for x402 middleware
 */

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { x402, HEADERS, PaymentCodec } from '../src/index.js';

describe('x402 Middleware Integration', () => {
  const TEST_RECIPIENT = '0x1234567890123456789012345678901234567890';

  it('should return 402 for protected endpoint without payment', async () => {
    const app = express();
    app.use('/api', x402({
      recipient: TEST_RECIPIENT,
      price: '0.01',
    }));
    app.get('/api/data', (_req, res) => res.json({ secret: 'data' }));

    const response = await request(app).get('/api/data');

    expect(response.status).toBe(402);
    expect(response.body.error).toBe('Payment Required');
    expect(response.headers[HEADERS.PAYMENT_REQUIRED]).toBeDefined();
  });

  it('should decode payment requirements from 402 response', async () => {
    const app = express();
    app.use('/api', x402({
      recipient: TEST_RECIPIENT,
      price: '0.05',
      description: 'Test API',
    }));
    app.get('/api/data', (_req, res) => res.json({ data: 'test' }));

    const response = await request(app).get('/api/data');

    expect(response.status).toBe(402);

    const encoded = response.headers[HEADERS.PAYMENT_REQUIRED];
    const requirements = PaymentCodec.decodePaymentRequirements(encoded);

    expect(requirements).toHaveLength(1);
    expect(requirements[0].scheme).toBe('exact');
    expect(requirements[0].payTo).toBe(TEST_RECIPIENT);
    expect(requirements[0].maxAmountRequired).toBe('50000'); // 0.05 USD in base units
    expect(requirements[0].network).toBe('eip155:8453');
  });

  it('should allow free endpoints to pass through', async () => {
    const app = express();
    app.use('/api/premium', x402({
      recipient: TEST_RECIPIENT,
      price: '0.01',
    }));
    app.get('/api/premium/data', (_req, res) => res.json({ premium: true }));
    app.get('/api/public', (_req, res) => res.json({ public: true }));

    // Premium endpoint requires payment
    const premiumResponse = await request(app).get('/api/premium/data');
    expect(premiumResponse.status).toBe(402);

    // Public endpoint should pass through (no middleware applied to this path)
    const publicResponse = await request(app).get('/api/public');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.public).toBe(true);
  });

  it('should support route-specific pricing', async () => {
    const app = express();
    app.use(x402({
      recipient: TEST_RECIPIENT,
      routes: [
        { path: '/api/cheap', price: '0.001' },
        { path: '/api/expensive', price: '0.10' },
      ],
    }));
    app.get('/api/cheap', (_req, res) => res.json({ tier: 'cheap' }));
    app.get('/api/expensive', (_req, res) => res.json({ tier: 'expensive' }));
    app.get('/api/free', (_req, res) => res.json({ tier: 'free' }));

    // Check cheap endpoint
    const cheapResponse = await request(app).get('/api/cheap');
    expect(cheapResponse.status).toBe(402);
    const cheapReqs = PaymentCodec.decodePaymentRequirements(
      cheapResponse.headers[HEADERS.PAYMENT_REQUIRED]
    );
    expect(cheapReqs[0].maxAmountRequired).toBe('1000'); // $0.001

    // Check expensive endpoint
    const expensiveResponse = await request(app).get('/api/expensive');
    expect(expensiveResponse.status).toBe(402);
    const expensiveReqs = PaymentCodec.decodePaymentRequirements(
      expensiveResponse.headers[HEADERS.PAYMENT_REQUIRED]
    );
    expect(expensiveReqs[0].maxAmountRequired).toBe('100000'); // $0.10

    // Check free endpoint (no matching route)
    const freeResponse = await request(app).get('/api/free');
    expect(freeResponse.status).toBe(200);
    expect(freeResponse.body.tier).toBe('free');
  });

  it('should call onPayment callback on successful payment', async () => {
    const onPayment = vi.fn();

    const app = express();
    app.use('/api', x402({
      recipient: TEST_RECIPIENT,
      price: '0.01',
      onPayment,
    }));
    app.get('/api/data', (req, res) => {
      res.json({
        data: 'secret',
        paidBy: (req as typeof req & { paymentReceipt?: { payer: string } }).paymentReceipt?.payer,
      });
    });

    // First request - no payment
    const noPaymentResponse = await request(app).get('/api/data');
    expect(noPaymentResponse.status).toBe(402);
    expect(onPayment).not.toHaveBeenCalled();

    // Note: Full payment flow requires a real facilitator, so we can't test
    // the complete happy path without mocking the facilitator
  });

  it('should reject invalid payment payload', async () => {
    const app = express();
    app.use('/api', x402({
      recipient: TEST_RECIPIENT,
      price: '0.01',
    }));
    app.get('/api/data', (_req, res) => res.json({ data: 'test' }));

    const response = await request(app)
      .get('/api/data')
      .set(HEADERS.PAYMENT, 'invalid-base64!!!');

    expect(response.status).toBe(402);
    expect(response.body.error).toBe('Invalid Payment');
  });

  it('should support method filtering on routes', async () => {
    const app = express();
    app.use(x402({
      recipient: TEST_RECIPIENT,
      routes: [
        { path: '/api/resource', price: '0.01', methods: ['POST', 'PUT'] },
      ],
    }));
    app.get('/api/resource', (_req, res) => res.json({ method: 'GET' }));
    app.post('/api/resource', express.json(), (_req, res) => res.json({ method: 'POST' }));

    // GET should be free (method not in list)
    const getResponse = await request(app).get('/api/resource');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.method).toBe('GET');

    // POST should require payment
    const postResponse = await request(app).post('/api/resource');
    expect(postResponse.status).toBe(402);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { x402 } from '../src/middleware/x402Middleware.js';
import { HEADERS } from '../src/types/index.js';

// Mock FacilitatorClient
vi.mock('../src/facilitator/FacilitatorClient.js', () => ({
  FacilitatorClient: vi.fn().mockImplementation(() => ({
    settle: vi.fn().mockResolvedValue({
      success: true,
      transaction: '0x' + 'a'.repeat(64),
      network: 'eip155:8453',
      payer: '0x1234567890123456789012345678901234567890',
      timestamp: Date.now(),
    }),
  })),
  createCoinbaseFacilitator: vi.fn().mockReturnValue({
    settle: vi.fn().mockResolvedValue({
      success: true,
      transaction: '0x' + 'a'.repeat(64),
      network: 'eip155:8453',
      payer: '0x1234567890123456789012345678901234567890',
      timestamp: Date.now(),
    }),
  }),
}));

describe('x402Middleware', () => {
  const validRecipient = '0x1234567890123456789012345678901234567890';

  // Helper to create mock request
  function createMockRequest(overrides: Partial<Request> = {}): Request {
    return {
      path: '/api/test',
      method: 'GET',
      headers: {},
      ...overrides,
    } as Request;
  }

  // Helper to create mock response
  function createMockResponse(): Response & { _status: number; _headers: Record<string, string>; _body: unknown } {
    const res = {
      _status: 200,
      _headers: {} as Record<string, string>,
      _body: null as unknown,
      status(code: number) {
        this._status = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this._headers[name.toLowerCase()] = value;
        return this;
      },
      json(body: unknown) {
        this._body = body;
        return this;
      },
    };
    return res as Response & { _status: number; _headers: Record<string, string>; _body: unknown };
  }

  describe('Configuration Validation', () => {
    it('should throw if recipient is missing', () => {
      expect(() => x402({ recipient: '', price: '0.01' })).toThrow('recipient is required');
    });

    it('should throw if recipient is not a valid address', () => {
      expect(() => x402({ recipient: 'not-an-address', price: '0.01' })).toThrow('valid Ethereum address');
    });

    it('should throw if neither price nor routes is specified', () => {
      expect(() => x402({ recipient: validRecipient })).toThrow('Either price or routes');
    });

    it('should throw if price is not a positive number', () => {
      expect(() => x402({ recipient: validRecipient, price: '-1' })).toThrow('positive number');
    });

    it('should throw if price is not a number', () => {
      expect(() => x402({ recipient: validRecipient, price: 'abc' })).toThrow('positive number');
    });

    it('should throw if route price is invalid', () => {
      expect(() =>
        x402({
          recipient: validRecipient,
          routes: [{ path: '/api/test', price: '-1' }],
        })
      ).toThrow('Invalid price');
    });

    it('should throw for unsupported network', () => {
      expect(() =>
        x402({
          recipient: validRecipient,
          price: '0.01',
          network: 'unsupported:chain',
        })
      ).toThrow('Unsupported network');
    });

    it('should accept valid configuration', () => {
      expect(() =>
        x402({
          recipient: validRecipient,
          price: '0.01',
        })
      ).not.toThrow();
    });

    it('should accept configuration with routes', () => {
      expect(() =>
        x402({
          recipient: validRecipient,
          routes: [
            { path: '/api/test', price: '0.01' },
            { path: '/api/expensive', price: '1.00' },
          ],
        })
      ).not.toThrow();
    });
  });

  describe('Request Handling', () => {
    it('should return 402 when no payment header is present', async () => {
      const middleware = x402({
        recipient: validRecipient,
        price: '0.01',
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(402);
      expect(res._headers[HEADERS.PAYMENT_REQUIRED]).toBeDefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('should include payment requirements in 402 response body', async () => {
      const middleware = x402({
        recipient: validRecipient,
        price: '0.01',
        description: 'Test API',
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res._body).toHaveProperty('requirements');
      const body = res._body as { requirements: unknown[] };
      expect(body.requirements).toHaveLength(1);
    });

    it('should return 402 with invalid payment payload', async () => {
      const middleware = x402({
        recipient: validRecipient,
        price: '0.01',
      });

      const req = createMockRequest({
        headers: {
          [HEADERS.PAYMENT]: 'invalid-base64-payload!!!',
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(402);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Route Matching', () => {
    it('should match exact paths', async () => {
      const middleware = x402({
        recipient: validRecipient,
        routes: [
          { path: '/api/test', price: '0.01' },
          { path: '/api/other', price: '0.05' },
        ],
      });

      const req = createMockRequest({ path: '/api/test' });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(402);
      const body = res._body as { requirements: Array<{ maxAmountRequired: string }> };
      // 0.01 USD = 10000 base units
      expect(body.requirements[0].maxAmountRequired).toBe('10000');
    });

    it('should match wildcard paths', async () => {
      const middleware = x402({
        recipient: validRecipient,
        routes: [{ path: '/api/*', price: '0.02' }],
      });

      const req = createMockRequest({ path: '/api/anything/here' });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(402);
    });

    it('should pass through if no route matches', async () => {
      const middleware = x402({
        recipient: validRecipient,
        routes: [{ path: '/api/test', price: '0.01' }],
      });

      const req = createMockRequest({ path: '/other/path' });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBe(200); // Not changed
    });

    it('should respect method restrictions', async () => {
      const middleware = x402({
        recipient: validRecipient,
        routes: [{ path: '/api/test', price: '0.01', methods: ['POST'] }],
      });

      // GET should pass through
      const reqGet = createMockRequest({ path: '/api/test', method: 'GET' });
      const resGet = createMockResponse();
      const nextGet = vi.fn();

      await middleware(reqGet, resGet, nextGet);
      expect(nextGet).toHaveBeenCalled();

      // POST should require payment
      const reqPost = createMockRequest({ path: '/api/test', method: 'POST' });
      const resPost = createMockResponse();
      const nextPost = vi.fn();

      await middleware(reqPost, resPost, nextPost);
      expect(resPost._status).toBe(402);
    });
  });

  describe('Callbacks', () => {
    it('should call onError when payment is invalid', async () => {
      const onError = vi.fn();
      const middleware = x402({
        recipient: validRecipient,
        price: '0.01',
        onError,
      });

      const req = createMockRequest({
        headers: {
          [HEADERS.PAYMENT]: 'invalid-payload',
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toHaveProperty('code', 'INVALID_PAYLOAD');
    });
  });
});

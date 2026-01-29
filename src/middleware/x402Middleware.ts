/**
 * x402Middleware - Express middleware for API monetization
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type {
  X402Config,
  RouteConfig,
  PaymentRequirements,
  PaymentPayload,
  PaymentReceipt,
  X402Error,
} from '../types/index.js';
import {
  USDC_ADDRESSES,
  DEFAULT_NETWORK,
  HEADERS,
} from '../types/index.js';
import {
  encodePaymentRequirements,
  decodePaymentPayload,
  encodeSettlementResponse,
  createPaymentRequirements,
  usdToBaseUnits,
} from '../codec/PaymentCodec.js';
import { FacilitatorClient, createCoinbaseFacilitator } from '../facilitator/FacilitatorClient.js';

/**
 * Create x402 payment middleware
 *
 * @example
 * // Simple usage - protect all routes with a single price
 * app.use('/api/premium', x402({
 *   recipient: '0xYourWallet',
 *   price: '0.01',
 * }));
 *
 * @example
 * // Advanced usage - different prices for different routes
 * app.use(x402({
 *   recipient: '0xYourWallet',
 *   routes: [
 *     { path: '/api/weather', price: '0.001' },
 *     { path: '/api/ai/*', price: '0.05' },
 *   ],
 * }));
 */
export function x402(config: X402Config): RequestHandler {
  // Validate configuration
  validateConfig(config);

  // Initialize facilitator client
  const facilitator = config.facilitator
    ? new FacilitatorClient(config.facilitator)
    : createCoinbaseFacilitator();

  // Get network and asset
  const network = config.network ?? DEFAULT_NETWORK;
  const asset = USDC_ADDRESSES[network];

  if (!asset) {
    throw new Error(`Unsupported network: ${network}. Supported: ${Object.keys(USDC_ADDRESSES).join(', ')}`);
  }

  // Create route matchers
  const routeMatchers = createRouteMatchers(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Find matching route config
      const routeConfig = findMatchingRoute(req.path, req.method, routeMatchers, config);

      // If no route matches, pass through
      if (!routeConfig) {
        next();
        return;
      }

      // Check for payment header
      const paymentHeader = req.headers[HEADERS.PAYMENT] as string | undefined;

      if (!paymentHeader) {
        // No payment - return 402 with requirements
        const requirements = createPaymentRequirements({
          network,
          asset,
          amount: usdToBaseUnits(routeConfig.price),
          recipient: config.recipient,
          description: routeConfig.description ?? config.description,
          resource: req.path,
        });

        const encoded = encodePaymentRequirements([requirements]);

        res.status(402);
        res.setHeader(HEADERS.PAYMENT_REQUIRED, encoded);
        res.setHeader('Content-Type', 'application/json');
        res.json({
          error: 'Payment Required',
          message: `This endpoint requires a payment of $${routeConfig.price} USD`,
          requirements: [requirements],
        });
        return;
      }

      // Parse and validate payment
      let paymentPayload: PaymentPayload;
      try {
        paymentPayload = decodePaymentPayload(paymentHeader);
      } catch (error) {
        const x402Error: X402Error = {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid payment payload format',
          cause: error instanceof Error ? error : undefined,
        };
        await handleError(x402Error, config);

        res.status(402);
        res.json({
          error: 'Invalid Payment',
          message: x402Error.message,
        });
        return;
      }

      // Create requirements for verification
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network,
        asset,
        maxAmountRequired: usdToBaseUnits(routeConfig.price),
        payTo: config.recipient,
        resource: req.path,
      };

      // Validate payment matches requirements
      const validationError = validatePaymentAgainstRequirements(paymentPayload, requirements);
      if (validationError) {
        const x402Error: X402Error = {
          code: 'INVALID_PAYLOAD',
          message: validationError,
        };
        await handleError(x402Error, config);

        res.status(402);
        res.json({
          error: 'Invalid Payment',
          message: validationError,
        });
        return;
      }

      // Settle payment via facilitator
      const settlement = await facilitator.settle(paymentPayload, requirements);

      if (!settlement.success) {
        const x402Error: X402Error = {
          code: 'SETTLEMENT_FAILED',
          message: settlement.errorReason ?? 'Payment settlement failed',
        };
        await handleError(x402Error, config);

        res.status(402);
        res.json({
          error: 'Settlement Failed',
          message: settlement.errorReason ?? 'Payment could not be settled on-chain',
        });
        return;
      }

      // Payment successful!
      // Add settlement response header
      res.setHeader(HEADERS.PAYMENT_RESPONSE, encodeSettlementResponse(settlement));

      // Create receipt for callback
      const receipt: PaymentReceipt = {
        payer: settlement.payer,
        amount: routeConfig.price,
        transactionHash: settlement.transaction ?? '',
        network,
        timestamp: settlement.timestamp ?? Date.now(),
        resource: req.path,
      };

      // Attach receipt to request for downstream handlers
      (req as Request & { paymentReceipt?: PaymentReceipt }).paymentReceipt = receipt;

      // Call success callback
      if (config.onPayment) {
        try {
          await config.onPayment(receipt);
        } catch (callbackError) {
          // Log but don't fail the request
          console.error('[x402] onPayment callback error:', callbackError);
        }
      }

      // Continue to the actual route handler
      next();
    } catch (error) {
      // Unexpected error
      const x402Error: X402Error = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unexpected error processing payment',
        cause: error instanceof Error ? error : undefined,
      };
      await handleError(x402Error, config);

      res.status(500);
      res.json({
        error: 'Internal Error',
        message: 'An error occurred while processing the payment',
      });
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface RouteMatcher {
  pattern: RegExp;
  methods: Set<string>;
  config: RouteConfig;
}

function validateConfig(config: X402Config): void {
  if (!config.recipient) {
    throw new Error('recipient is required');
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(config.recipient)) {
    throw new Error('recipient must be a valid Ethereum address');
  }

  if (!config.price && !config.routes?.length) {
    throw new Error('Either price or routes must be specified');
  }

  if (config.price) {
    const price = parseFloat(config.price);
    if (isNaN(price) || price <= 0) {
      throw new Error('price must be a positive number');
    }
  }

  if (config.routes) {
    for (const route of config.routes) {
      if (!route.path) {
        throw new Error('Each route must have a path');
      }
      const price = parseFloat(route.price);
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for route ${route.path}`);
      }
    }
  }
}

function createRouteMatchers(config: X402Config): RouteMatcher[] {
  if (!config.routes?.length) {
    return [];
  }

  return config.routes.map((route) => ({
    pattern: pathToRegex(route.path),
    methods: new Set((route.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).map((m) => m.toUpperCase())),
    config: route,
  }));
}

function pathToRegex(path: string): RegExp {
  // Convert Express-style path patterns to regex
  // /api/weather -> /^\/api\/weather$/
  // /api/* -> /^\/api\/.*$/
  // /api/:id -> /^\/api\/[^/]+$/

  let pattern = path
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars (except *)
    .replace(/\*/g, '.*') // * -> .*
    .replace(/:[\w]+/g, '[^/]+'); // :param -> [^/]+

  return new RegExp(`^${pattern}$`);
}

function findMatchingRoute(
  path: string,
  method: string,
  matchers: RouteMatcher[],
  config: X402Config
): RouteConfig | null {
  // If specific routes are defined, find a match
  if (matchers.length > 0) {
    for (const matcher of matchers) {
      if (matcher.pattern.test(path) && matcher.methods.has(method.toUpperCase())) {
        return matcher.config;
      }
    }
    return null; // No matching route
  }

  // If no routes defined, use default price for all requests
  if (config.price) {
    return {
      path: '*',
      price: config.price,
      description: config.description,
    };
  }

  return null;
}

function validatePaymentAgainstRequirements(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): string | null {
  // Check network matches
  if (payload.network !== requirements.network) {
    return `Network mismatch: expected ${requirements.network}, got ${payload.network}`;
  }

  // Check recipient matches
  if (payload.payload.authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return `Recipient mismatch: expected ${requirements.payTo}, got ${payload.payload.authorization.to}`;
  }

  // Check amount is sufficient
  const paymentAmount = BigInt(payload.payload.authorization.value);
  const requiredAmount = BigInt(requirements.maxAmountRequired);
  if (paymentAmount < requiredAmount) {
    return `Insufficient amount: required ${requirements.maxAmountRequired}, got ${payload.payload.authorization.value}`;
  }

  // Check validity window
  const now = Math.floor(Date.now() / 1000);
  if (payload.payload.authorization.validAfter > now) {
    return `Payment not yet valid (validAfter: ${payload.payload.authorization.validAfter})`;
  }
  if (payload.payload.authorization.validBefore < now) {
    return `Payment expired (validBefore: ${payload.payload.authorization.validBefore})`;
  }

  return null; // Valid
}

async function handleError(error: X402Error, config: X402Config): Promise<void> {
  if (config.onError) {
    try {
      await config.onError(error);
    } catch (callbackError) {
      console.error('[x402] onError callback error:', callbackError);
    }
  }
}

// Type augmentation for Express Request
declare module 'express' {
  interface Request {
    paymentReceipt?: PaymentReceipt;
  }
}

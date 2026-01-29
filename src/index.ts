/**
 * @eco/x402 - Drop-in Express middleware for API monetization
 *
 * @example
 * import { x402 } from '@eco/x402';
 *
 * app.use('/api/premium', x402({
 *   recipient: '0xYourWallet',
 *   price: '0.01',
 * }));
 */

// Main middleware
export { x402 } from './middleware/x402Middleware.js';

// Facilitator client
export {
  FacilitatorClient,
  FacilitatorError,
  createCoinbaseFacilitator,
  createFacilitator,
} from './facilitator/FacilitatorClient.js';

// Codec utilities
export {
  PaymentCodec,
  encodePaymentRequirements,
  decodePaymentRequirements,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
  createPaymentRequirements,
  usdToBaseUnits,
  baseUnitsToUsd,
} from './codec/PaymentCodec.js';

// Types
export type {
  X402Config,
  RouteConfig,
  FacilitatorConfig,
  PaymentRequirements,
  PaymentPayload,
  TransferAuthorization,
  SettlementResponse,
  VerificationResponse,
  PaymentReceipt,
  X402Error,
} from './types/index.js';

// Constants
export {
  USDC_ADDRESSES,
  DEFAULT_NETWORK,
  USDC_DECIMALS,
  COINBASE_FACILITATOR_URL,
  HEADERS,
} from './types/index.js';

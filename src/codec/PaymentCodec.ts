/**
 * PaymentCodec - Encode/decode x402 protocol headers
 */

import type {
  PaymentRequirements,
  PaymentPayload,
  SettlementResponse,
} from '../types/index.js';

/**
 * Encode payment requirements for PAYMENT-REQUIRED header
 */
export function encodePaymentRequirements(requirements: PaymentRequirements[]): string {
  const json = JSON.stringify(requirements);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Decode payment requirements from PAYMENT-REQUIRED header
 */
export function decodePaymentRequirements(encoded: string): PaymentRequirements[] {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      throw new Error('Payment requirements must be an array');
    }

    // Validate each requirement
    for (const req of parsed) {
      validatePaymentRequirements(req);
    }

    return parsed as PaymentRequirements[];
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid Base64 or JSON in payment requirements');
    }
    throw error;
  }
}

/**
 * Decode payment payload from X-PAYMENT header
 */
export function decodePaymentPayload(encoded: string): PaymentPayload {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    validatePaymentPayload(parsed);

    return parsed as PaymentPayload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid Base64 or JSON in payment payload');
    }
    throw error;
  }
}

/**
 * Encode payment payload for X-PAYMENT header
 */
export function encodePaymentPayload(payload: PaymentPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Encode settlement response for PAYMENT-RESPONSE header
 */
export function encodeSettlementResponse(response: SettlementResponse): string {
  const json = JSON.stringify(response);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Decode settlement response from PAYMENT-RESPONSE header
 */
export function decodeSettlementResponse(encoded: string): SettlementResponse {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json) as SettlementResponse;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid Base64 or JSON in settlement response');
    }
    throw error;
  }
}

/**
 * Create payment requirements from configuration
 */
export function createPaymentRequirements(params: {
  network: string;
  asset: string;
  amount: string;
  recipient: string;
  description?: string;
  resource?: string;
}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: params.network,
    asset: params.asset,
    maxAmountRequired: params.amount,
    payTo: params.recipient,
    description: params.description,
    resource: params.resource,
  };
}

/**
 * Convert USD price string to USDC base units (6 decimals)
 */
export function usdToBaseUnits(usdPrice: string): string {
  // Parse the USD price
  const price = parseFloat(usdPrice);
  if (isNaN(price) || price < 0) {
    throw new Error(`Invalid USD price: ${usdPrice}`);
  }

  // Convert to base units (6 decimals for USDC)
  const priceInCents = Math.round(price * 1_000_000);

  return priceInCents.toString();
}

/**
 * Convert USDC base units to USD string
 */
export function baseUnitsToUsd(baseUnits: string): string {
  const units = BigInt(baseUnits);
  const divisor = BigInt(1_000_000);

  const wholePart = units / divisor;
  const fractionalPart = units % divisor;

  // Format with proper decimal places
  const fractionalStr = fractionalPart.toString().padStart(6, '0');

  // Trim trailing zeros but keep at least 2 decimal places
  let trimmed = fractionalStr.replace(/0+$/, '');
  if (trimmed.length < 2) {
    trimmed = fractionalStr.slice(0, 2);
  }

  return `${wholePart}.${trimmed}`;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validatePaymentRequirements(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Payment requirement must be an object');
  }

  const req = obj as Record<string, unknown>;

  if (req.scheme !== 'exact') {
    throw new Error('Only "exact" scheme is supported');
  }

  if (typeof req.network !== 'string' || !req.network) {
    throw new Error('Invalid or missing network');
  }

  if (typeof req.asset !== 'string' || !isValidAddress(req.asset)) {
    throw new Error('Invalid or missing asset address');
  }

  if (typeof req.maxAmountRequired !== 'string' || !isValidAmount(req.maxAmountRequired)) {
    throw new Error('Invalid or missing maxAmountRequired');
  }

  if (typeof req.payTo !== 'string' || !isValidAddress(req.payTo)) {
    throw new Error('Invalid or missing payTo address');
  }
}

function validatePaymentPayload(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Payment payload must be an object');
  }

  const payload = obj as Record<string, unknown>;

  // Check version
  if (payload.x402Version !== '2.0' && payload.x402Version !== '1') {
    throw new Error('Invalid x402Version');
  }

  if (payload.scheme !== 'exact') {
    throw new Error('Only "exact" scheme is supported');
  }

  if (typeof payload.network !== 'string' || !payload.network) {
    throw new Error('Invalid or missing network');
  }

  // Validate nested payload
  if (typeof payload.payload !== 'object' || payload.payload === null) {
    throw new Error('Invalid or missing payload object');
  }

  const inner = payload.payload as Record<string, unknown>;

  if (typeof inner.signature !== 'string' || !isValidSignature(inner.signature)) {
    throw new Error('Invalid or missing signature');
  }

  if (typeof inner.authorization !== 'object' || inner.authorization === null) {
    throw new Error('Invalid or missing authorization');
  }

  validateAuthorization(inner.authorization);
}

function validateAuthorization(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Authorization must be an object');
  }

  const auth = obj as Record<string, unknown>;

  if (typeof auth.from !== 'string' || !isValidAddress(auth.from)) {
    throw new Error('Invalid or missing from address');
  }

  if (typeof auth.to !== 'string' || !isValidAddress(auth.to)) {
    throw new Error('Invalid or missing to address');
  }

  if (typeof auth.value !== 'string' || !isValidAmount(auth.value)) {
    throw new Error('Invalid or missing value');
  }

  if (typeof auth.validAfter !== 'number' || auth.validAfter < 0) {
    throw new Error('Invalid or missing validAfter');
  }

  if (typeof auth.validBefore !== 'number' || auth.validBefore < 0) {
    throw new Error('Invalid or missing validBefore');
  }

  if (typeof auth.nonce !== 'string' || !isValidNonce(auth.nonce)) {
    throw new Error('Invalid or missing nonce');
  }
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isValidAmount(amount: string): boolean {
  return /^\d+$/.test(amount) && BigInt(amount) >= 0;
}

function isValidSignature(sig: string): boolean {
  // 65 bytes = 130 hex chars + 0x prefix
  return /^0x[a-fA-F0-9]{130}$/.test(sig);
}

function isValidNonce(nonce: string): boolean {
  // 32 bytes = 64 hex chars + 0x prefix
  return /^0x[a-fA-F0-9]{64}$/.test(nonce);
}

export const PaymentCodec = {
  encodePaymentRequirements,
  decodePaymentRequirements,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
  createPaymentRequirements,
  usdToBaseUnits,
  baseUnitsToUsd,
};

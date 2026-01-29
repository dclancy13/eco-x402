/**
 * x402 Protocol Types
 * Based on x402 v2 specification
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for a protected route
 */
export interface RouteConfig {
  /** Express route pattern (e.g., '/api/weather', '/api/*') */
  path: string;
  /** Price in USD as a string (e.g., '0.01' for 1 cent) */
  price: string;
  /** Human-readable description of the resource */
  description?: string;
  /** HTTP methods to protect (default: ['GET', 'POST', 'PUT', 'DELETE']) */
  methods?: string[];
}

/**
 * Main middleware configuration
 */
export interface X402Config {
  /** Wallet address to receive payments */
  recipient: string;
  /** Price in USD (e.g., '0.01') - used when routes is not specified */
  price?: string;
  /** Protected routes configuration */
  routes?: RouteConfig[];
  /** Description for payment requirements */
  description?: string;
  /** CAIP-2 network identifier (default: 'eip155:8453' for Base mainnet) */
  network?: string;
  /** Facilitator configuration */
  facilitator?: FacilitatorConfig;
  /** Callback when payment is received */
  onPayment?: (receipt: PaymentReceipt) => void | Promise<void>;
  /** Callback when payment fails */
  onError?: (error: X402Error) => void | Promise<void>;
}

/**
 * Facilitator service configuration
 */
export interface FacilitatorConfig {
  /** Facilitator base URL */
  url: string;
  /** Optional API key for the facilitator */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// ============================================================================
// x402 Protocol Types (per specification)
// ============================================================================

/**
 * Payment requirements returned in 402 response
 * Encoded as Base64 JSON in PAYMENT-REQUIRED header
 */
export interface PaymentRequirements {
  /** Payment scheme (only 'exact' supported currently) */
  scheme: 'exact';
  /** CAIP-2 network identifier (e.g., 'eip155:8453') */
  network: string;
  /** Token contract address */
  asset: string;
  /** Maximum amount required in token base units */
  maxAmountRequired: string;
  /** Address to receive the payment */
  payTo: string;
  /** Optional description */
  description?: string;
  /** Optional resource path */
  resource?: string;
  /** Optional MIME type of the response */
  mimeType?: string;
  /** Optional JSON schema of the response */
  outputSchema?: Record<string, unknown>;
}

/**
 * EIP-3009 authorization structure
 */
export interface TransferAuthorization {
  /** Payer's wallet address */
  from: string;
  /** Recipient's wallet address */
  to: string;
  /** Amount in token base units */
  value: string;
  /** Unix timestamp after which the authorization is valid */
  validAfter: number;
  /** Unix timestamp before which the authorization is valid */
  validBefore: number;
  /** Unique 32-byte nonce (hex string with 0x prefix) */
  nonce: string;
}

/**
 * Payment payload sent by client in X-PAYMENT header
 * Encoded as Base64 JSON
 */
export interface PaymentPayload {
  /** Protocol version */
  x402Version: '2.0' | '1';
  /** Payment scheme */
  scheme: 'exact';
  /** CAIP-2 network identifier */
  network: string;
  /** Scheme-specific payload */
  payload: {
    /** ECDSA signature (65 bytes, hex with 0x prefix) */
    signature: string;
    /** Authorization details */
    authorization: TransferAuthorization;
  };
}

/**
 * Settlement response from facilitator
 */
export interface SettlementResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** On-chain transaction hash */
  transaction?: string;
  /** Network where settlement occurred */
  network: string;
  /** Payer's address */
  payer: string;
  /** Unix timestamp of settlement */
  timestamp?: number;
  /** Error reason if unsuccessful */
  errorReason?: string;
}

/**
 * Verification response from facilitator
 */
export interface VerificationResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Payer's address (if valid) */
  payer?: string;
  /** Reason for invalidity */
  invalidReason?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Payment receipt passed to callbacks
 */
export interface PaymentReceipt {
  /** Payer's wallet address */
  payer: string;
  /** Amount paid in USD */
  amount: string;
  /** On-chain transaction hash */
  transactionHash: string;
  /** Network where payment was made */
  network: string;
  /** Unix timestamp */
  timestamp: number;
  /** Resource path that was paid for */
  resource: string;
}

/**
 * Custom error for x402 payment failures
 */
export interface X402Error {
  /** Error code */
  code: 'INVALID_SIGNATURE' | 'EXPIRED' | 'INSUFFICIENT_FUNDS' | 'SETTLEMENT_FAILED' | 'NETWORK_ERROR' | 'INVALID_PAYLOAD';
  /** Human-readable message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * USDC contract addresses by network
 */
export const USDC_ADDRESSES: Record<string, string> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',    // Base Mainnet
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',   // Base Sepolia
  'eip155:137': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',     // Polygon Mainnet
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',       // Ethereum Mainnet
  'eip155:42161': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',   // Arbitrum One
  'eip155:10': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',      // Optimism
};

/**
 * Default network (Base Mainnet)
 */
export const DEFAULT_NETWORK = 'eip155:8453';

/**
 * USDC has 6 decimals
 */
export const USDC_DECIMALS = 6;

/**
 * Default Coinbase facilitator URL
 */
export const COINBASE_FACILITATOR_URL = 'https://x402.org/facilitator';

/**
 * HTTP header names
 */
export const HEADERS = {
  PAYMENT_REQUIRED: 'x-payment-required',
  PAYMENT: 'x-payment',
  PAYMENT_RESPONSE: 'x-payment-response',
} as const;

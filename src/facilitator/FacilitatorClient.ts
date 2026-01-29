/**
 * FacilitatorClient - HTTP client for x402 facilitator services
 */

import type {
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  VerificationResponse,
} from '../types/index.js';
import { COINBASE_FACILITATOR_URL } from '../types/index.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<FacilitatorConfig, 'apiKey'>> = {
  url: COINBASE_FACILITATOR_URL,
  timeout: 30000,
};

/**
 * FacilitatorClient handles communication with x402 facilitator services
 */
export class FacilitatorClient {
  private readonly config: Required<Omit<FacilitatorConfig, 'apiKey'>> & { apiKey?: string };

  constructor(config?: Partial<FacilitatorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Verify a payment without settling
   * Checks signature validity and authorization parameters
   */
  async verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerificationResponse> {
    const response = await this.request<VerificationResponse>('/verify', {
      paymentPayload,
      paymentRequirements,
    });

    return response;
  }

  /**
   * Verify and settle a payment on-chain
   * Returns transaction hash on success
   */
  async settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettlementResponse> {
    const response = await this.request<SettlementResponse>('/settle', {
      paymentPayload,
      paymentRequirements,
    });

    return response;
  }

  /**
   * Check the status of a settlement transaction
   */
  async getStatus(transactionHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: number;
    timestamp?: number;
  }> {
    const response = await this.request<{
      confirmed: boolean;
      blockNumber?: number;
      timestamp?: number;
    }>(`/status/${transactionHash}`, undefined, 'GET');

    return response;
  }

  /**
   * Make an HTTP request to the facilitator
   */
  private async request<T>(
    endpoint: string,
    body?: unknown,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<T> {
    const url = `${this.config.url}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new FacilitatorError(
          `Facilitator request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FacilitatorError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FacilitatorError('Request timeout', 408, 'Request timed out');
        }
        throw new FacilitatorError(
          `Network error: ${error.message}`,
          0,
          error.message
        );
      }

      throw new FacilitatorError('Unknown error', 0, String(error));
    }
  }
}

/**
 * Custom error class for facilitator errors
 */
export class FacilitatorError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }
}

/**
 * Create a FacilitatorClient configured for Coinbase's hosted facilitator
 */
export function createCoinbaseFacilitator(): FacilitatorClient {
  return new FacilitatorClient({
    url: COINBASE_FACILITATOR_URL,
  });
}

/**
 * Create a FacilitatorClient with custom configuration
 */
export function createFacilitator(config: FacilitatorConfig): FacilitatorClient {
  return new FacilitatorClient(config);
}

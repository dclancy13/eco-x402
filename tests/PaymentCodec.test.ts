import { describe, it, expect } from 'vitest';
import {
  encodePaymentRequirements,
  decodePaymentRequirements,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
  decodeSettlementResponse,
  createPaymentRequirements,
  usdToBaseUnits,
  baseUnitsToUsd,
} from '../src/codec/PaymentCodec.js';
import type { PaymentRequirements, PaymentPayload, SettlementResponse } from '../src/types/index.js';

describe('PaymentCodec', () => {
  describe('encodePaymentRequirements / decodePaymentRequirements', () => {
    const validRequirements: PaymentRequirements[] = [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        maxAmountRequired: '1000000',
        payTo: '0x1234567890123456789012345678901234567890',
        description: 'Test payment',
        resource: '/api/test',
      },
    ];

    it('should encode and decode payment requirements correctly', () => {
      const encoded = encodePaymentRequirements(validRequirements);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodePaymentRequirements(encoded);
      expect(decoded).toEqual(validRequirements);
    });

    it('should encode to valid Base64', () => {
      const encoded = encodePaymentRequirements(validRequirements);
      // Should not throw when decoding Base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('should throw on invalid Base64', () => {
      expect(() => decodePaymentRequirements('not-valid-base64!!!')).toThrow();
    });

    it('should throw on invalid JSON', () => {
      const invalidBase64 = Buffer.from('not json', 'utf-8').toString('base64');
      expect(() => decodePaymentRequirements(invalidBase64)).toThrow();
    });

    it('should throw if requirements is not an array', () => {
      const notArray = Buffer.from(JSON.stringify({ scheme: 'exact' }), 'utf-8').toString('base64');
      expect(() => decodePaymentRequirements(notArray)).toThrow('must be an array');
    });

    it('should throw on invalid scheme', () => {
      const invalid = Buffer.from(JSON.stringify([{ ...validRequirements[0], scheme: 'wrong' }]), 'utf-8').toString('base64');
      expect(() => decodePaymentRequirements(invalid)).toThrow('Only "exact" scheme');
    });

    it('should throw on invalid address', () => {
      const invalid = Buffer.from(JSON.stringify([{ ...validRequirements[0], payTo: 'not-an-address' }]), 'utf-8').toString('base64');
      expect(() => decodePaymentRequirements(invalid)).toThrow('Invalid or missing payTo');
    });
  });

  describe('encodePaymentPayload / decodePaymentPayload', () => {
    const validPayload: PaymentPayload = {
      x402Version: '2.0',
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '1000000',
          validAfter: 1704067200,
          validBefore: 1704067500,
          nonce: '0x' + 'b'.repeat(64),
        },
      },
    };

    it('should encode and decode payment payload correctly', () => {
      const encoded = encodePaymentPayload(validPayload);
      expect(typeof encoded).toBe('string');

      const decoded = decodePaymentPayload(encoded);
      expect(decoded).toEqual(validPayload);
    });

    it('should accept version 1 payloads', () => {
      const v1Payload = { ...validPayload, x402Version: '1' as const };
      const encoded = encodePaymentPayload(v1Payload);
      const decoded = decodePaymentPayload(encoded);
      expect(decoded.x402Version).toBe('1');
    });

    it('should throw on invalid version', () => {
      const invalid = { ...validPayload, x402Version: '3.0' };
      const encoded = Buffer.from(JSON.stringify(invalid), 'utf-8').toString('base64');
      expect(() => decodePaymentPayload(encoded)).toThrow('Invalid x402Version');
    });

    it('should throw on invalid signature format', () => {
      const invalid = {
        ...validPayload,
        payload: { ...validPayload.payload, signature: 'not-a-signature' },
      };
      const encoded = Buffer.from(JSON.stringify(invalid), 'utf-8').toString('base64');
      expect(() => decodePaymentPayload(encoded)).toThrow('Invalid or missing signature');
    });

    it('should throw on invalid nonce format', () => {
      const invalid = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: { ...validPayload.payload.authorization, nonce: '0x123' },
        },
      };
      const encoded = Buffer.from(JSON.stringify(invalid), 'utf-8').toString('base64');
      expect(() => decodePaymentPayload(encoded)).toThrow('Invalid or missing nonce');
    });
  });

  describe('encodeSettlementResponse / decodeSettlementResponse', () => {
    const validResponse: SettlementResponse = {
      success: true,
      transaction: '0x' + 'c'.repeat(64),
      network: 'eip155:8453',
      payer: '0x1234567890123456789012345678901234567890',
      timestamp: 1704067200,
    };

    it('should encode and decode settlement response correctly', () => {
      const encoded = encodeSettlementResponse(validResponse);
      const decoded = decodeSettlementResponse(encoded);
      expect(decoded).toEqual(validResponse);
    });

    it('should handle failed settlement', () => {
      const failedResponse: SettlementResponse = {
        success: false,
        network: 'eip155:8453',
        payer: '0x1234567890123456789012345678901234567890',
        errorReason: 'Insufficient funds',
      };
      const encoded = encodeSettlementResponse(failedResponse);
      const decoded = decodeSettlementResponse(encoded);
      expect(decoded.success).toBe(false);
      expect(decoded.errorReason).toBe('Insufficient funds');
    });
  });

  describe('createPaymentRequirements', () => {
    it('should create valid payment requirements', () => {
      const requirements = createPaymentRequirements({
        network: 'eip155:8453',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: '1000000',
        recipient: '0x1234567890123456789012345678901234567890',
        description: 'Test payment',
        resource: '/api/test',
      });

      expect(requirements.scheme).toBe('exact');
      expect(requirements.network).toBe('eip155:8453');
      expect(requirements.maxAmountRequired).toBe('1000000');
      expect(requirements.description).toBe('Test payment');
    });
  });

  describe('usdToBaseUnits', () => {
    it('should convert $1.00 to 1000000', () => {
      expect(usdToBaseUnits('1.00')).toBe('1000000');
    });

    it('should convert $0.01 to 10000', () => {
      expect(usdToBaseUnits('0.01')).toBe('10000');
    });

    it('should convert $0.001 to 1000', () => {
      expect(usdToBaseUnits('0.001')).toBe('1000');
    });

    it('should convert $100 to 100000000', () => {
      expect(usdToBaseUnits('100')).toBe('100000000');
    });

    it('should handle small amounts like $0.000001', () => {
      expect(usdToBaseUnits('0.000001')).toBe('1');
    });

    it('should throw on invalid input', () => {
      expect(() => usdToBaseUnits('not-a-number')).toThrow('Invalid USD price');
    });

    it('should throw on negative input', () => {
      expect(() => usdToBaseUnits('-1.00')).toThrow('Invalid USD price');
    });
  });

  describe('baseUnitsToUsd', () => {
    it('should convert 1000000 to $1.00', () => {
      expect(baseUnitsToUsd('1000000')).toBe('1.00');
    });

    it('should convert 10000 to $0.01', () => {
      expect(baseUnitsToUsd('10000')).toBe('0.01');
    });

    it('should convert 1 to $0.000001', () => {
      expect(baseUnitsToUsd('1')).toBe('0.000001');
    });

    it('should convert 100000000 to $100.00', () => {
      expect(baseUnitsToUsd('100000000')).toBe('100.00');
    });

    it('should handle amounts with trailing zeros', () => {
      expect(baseUnitsToUsd('1500000')).toBe('1.50');
    });
  });
});

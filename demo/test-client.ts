/**
 * Test Client for @eco/x402
 *
 * Demonstrates the complete payment flow:
 * 1. Make request to protected endpoint
 * 2. Receive 402 with payment requirements
 * 3. Generate payment payload with mock signature
 * 4. Retry request with payment
 * 5. Receive the protected content
 *
 * Run with: npx ts-node demo/test-client.ts
 */

import { PaymentCodec, HEADERS } from '../src/index.js';
import type { PaymentPayload, PaymentRequirements } from '../src/types/index.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Mock wallet for testing
const MOCK_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f5e321';

/**
 * Create a mock payment payload
 * In production, this would use a real wallet to sign the authorization
 */
function createMockPayment(requirements: PaymentRequirements): PaymentPayload {
  const now = Math.floor(Date.now() / 1000);

  return {
    x402Version: '2.0',
    scheme: 'exact',
    network: requirements.network,
    payload: {
      signature: '0x' + 'ab'.repeat(65), // Mock 65-byte signature
      authorization: {
        from: MOCK_WALLET,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: now - 60,
        validBefore: now + 3600,
        nonce: '0x' + randomHex(64),
      },
    },
  };
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Make a paid request to a protected endpoint
 */
async function makePaidRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: object): Promise<void> {
  const url = `${SERVER_URL}${endpoint}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📡 ${method} ${endpoint}`);
  console.log('='.repeat(60));

  // Step 1: Make initial request (expect 402)
  console.log('\n1️⃣  Making initial request...');

  const initialOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method === 'POST') {
    initialOptions.body = JSON.stringify(body);
  }

  const initialResponse = await fetch(url, initialOptions);

  if (initialResponse.status !== 402) {
    if (initialResponse.ok) {
      console.log('   ✅ Endpoint is free! No payment required.');
      const data = await initialResponse.json();
      console.log('   Response:', JSON.stringify(data, null, 2));
      return;
    } else {
      console.error(`   ❌ Unexpected response: ${initialResponse.status}`);
      const text = await initialResponse.text();
      console.error('   ', text);
      return;
    }
  }

  console.log('   📋 Received 402 Payment Required');

  // Step 2: Parse payment requirements
  const paymentHeader = initialResponse.headers.get(HEADERS.PAYMENT_REQUIRED);
  if (!paymentHeader) {
    console.error('   ❌ No payment requirements header found');
    return;
  }

  const requirements = PaymentCodec.decodePaymentRequirements(paymentHeader);
  const req = requirements[0];

  console.log('\n2️⃣  Payment Requirements:');
  console.log(`   Network:   ${req.network}`);
  console.log(`   Asset:     ${req.asset}`);
  console.log(`   Amount:    ${req.maxAmountRequired} (${formatUSDC(req.maxAmountRequired)})`);
  console.log(`   Recipient: ${req.payTo}`);
  console.log(`   Resource:  ${req.resource || endpoint}`);

  // Step 3: Create payment payload
  console.log('\n3️⃣  Creating payment payload...');
  const payment = createMockPayment(req);
  const encodedPayment = PaymentCodec.encodePaymentPayload(payment);

  console.log(`   Payer:  ${payment.payload.authorization.from}`);
  console.log(`   Amount: ${payment.payload.authorization.value}`);

  // Step 4: Retry with payment
  console.log('\n4️⃣  Sending payment...');

  const paidOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      [HEADERS.PAYMENT]: encodedPayment,
    },
  };
  if (body && method === 'POST') {
    paidOptions.body = JSON.stringify(body);
  }

  const paidResponse = await fetch(url, paidOptions);

  if (!paidResponse.ok) {
    console.error(`   ❌ Payment failed: ${paidResponse.status}`);
    const errorData = await paidResponse.json();
    console.error('   ', JSON.stringify(errorData, null, 2));
    return;
  }

  // Step 5: Success!
  console.log('   ✅ Payment accepted!');

  const responseHeader = paidResponse.headers.get(HEADERS.PAYMENT_RESPONSE);
  if (responseHeader) {
    const settlement = PaymentCodec.decodeSettlementResponse(responseHeader);
    console.log(`   TX Hash: ${settlement.transaction}`);
  }

  const data = await paidResponse.json();
  console.log('\n5️⃣  Response Data:');
  console.log(JSON.stringify(data, null, 2));
}

function formatUSDC(baseUnits: string): string {
  const dollars = Number(baseUnits) / 1_000_000;
  return `$${dollars.toFixed(6)} USDC`;
}

/**
 * Run all demo tests
 */
async function runDemo(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  @eco/x402 Test Client                         ║
╠════════════════════════════════════════════════════════════════╣
║  Server:     ${SERVER_URL.padEnd(42)} ║
║  Mock Wallet: ${MOCK_WALLET.slice(0, 10)}...${MOCK_WALLET.slice(-6)}                        ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    // Test 1: Free endpoint
    console.log('\n\n🆓 TEST 1: Free Endpoint');
    await makePaidRequest('/api/public');

    // Test 2: Premium joke (paid)
    console.log('\n\n💰 TEST 2: Premium Joke ($0.001)');
    await makePaidRequest('/api/premium/joke');

    // Test 3: Premium fortune (paid, different price)
    console.log('\n\n💰 TEST 3: Premium Fortune ($0.005)');
    await makePaidRequest('/api/premium/fortune');

    // Test 4: AI Generation (POST, paid)
    console.log('\n\n🤖 TEST 4: AI Generation ($0.01)');
    await makePaidRequest('/api/ai/generate', 'POST', {
      prompt: 'Write a haiku about crypto payments',
    });

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Error running tests:', error);
    console.error('\nMake sure the demo server and mock facilitator are running:');
    console.error('  Terminal 1: npx ts-node demo/mock-facilitator.ts');
    console.error('  Terminal 2: npx ts-node demo/demo-server.ts');
    console.error('  Terminal 3: npx ts-node demo/test-client.ts');
  }
}

// Run if executed directly
runDemo();

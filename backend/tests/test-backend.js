import axios from "axios";

const BASE_URL = "http://localhost:3001/api";

async function testBackend() {
  console.log("🧪 Testing RWAchain Backend\n");

  const tests = [
    { name: "Health Check", url: "/health" },
    { name: "Supported Currencies", url: "/oracle/supported-currencies" },
    { name: "Exchange Rate USD to PKR", url: "/oracle/currency-rate/USD/PKR" },
    { name: "Exchange Rate USD to AED", url: "/oracle/currency-rate/USD/AED" },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      const response = await axios.get(`${BASE_URL}${test.url}`);
      console.log(`✅ ${test.name}: SUCCESS`);
      console.log(
        `   Response:`,
        JSON.stringify(response.data).substring(0, 100) + "...\n",
      );
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
}

testBackend();

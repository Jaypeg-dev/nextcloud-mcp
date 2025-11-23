#!/usr/bin/env node

/**
 * Test script to verify Nextcloud connectivity
 * Run with: node test-connection.js
 */

import axios from 'axios';

const config = {
  url: process.env.NEXTCLOUD_URL || '',
  username: process.env.NEXTCLOUD_USERNAME || '',
  password: process.env.NEXTCLOUD_PASSWORD || '',
};

console.log('🔍 Testing Nextcloud Connection...\n');
console.log('Configuration:');
console.log(`  URL: ${config.url}`);
console.log(`  Username: ${config.username}`);
console.log(`  Password: ${config.password ? '***' + config.password.slice(-4) : '(not set)'}\n`);

if (!config.url || !config.username || !config.password) {
  console.error('❌ Error: Missing configuration!');
  console.error('Please set NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD environment variables.');
  console.error('\nYou can create a .env file with these values or export them:');
  console.error('  export NEXTCLOUD_URL=https://your-nextcloud.com');
  console.error('  export NEXTCLOUD_USERNAME=your-username');
  console.error('  export NEXTCLOUD_PASSWORD=your-app-password\n');
  process.exit(1);
}

const axiosInstance = axios.create({
  baseURL: config.url,
  auth: {
    username: config.username,
    password: config.password,
  },
});

async function testConnection() {
  const tests = [
    {
      name: 'Basic Authentication',
      test: async () => {
        const response = await axiosInstance.get('/ocs/v2.php/cloud/user');
        return { success: true, data: response.status === 200 };
      },
    },
    {
      name: 'CalDAV (Tasks)',
      test: async () => {
        const response = await axiosInstance.get(
          `/remote.php/dav/calendars/${config.username}/`
        );
        return { success: true, data: response.status === 207 || response.status === 200 };
      },
    },
    {
      name: 'Notes API',
      test: async () => {
        const response = await axiosInstance.get(
          '/index.php/apps/notes/api/v1/notes',
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          }
        );
        return { success: true, data: Array.isArray(response.data) };
      },
    },
    {
      name: 'Mail API (optional)',
      test: async () => {
        try {
          const response = await axiosInstance.get(
            '/index.php/apps/mail/api/accounts',
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );
          return { success: true, data: Array.isArray(response.data) };
        } catch (error) {
          // Mail app might not be installed
          return { success: false, data: 'Mail app not installed or not configured' };
        }
      },
    },
  ];

  console.log('Running connectivity tests...\n');

  for (const { name, test } of tests) {
    process.stdout.write(`Testing ${name}... `);
    try {
      const result = await test();
      if (result.success && result.data) {
        console.log('✅ PASSED');
      } else {
        console.log(`⚠️  WARNING: ${result.data}`);
      }
    } catch (error) {
      console.log('❌ FAILED');
      if (axios.isAxiosError(error)) {
        console.log(`  Error: ${error.message}`);
        if (error.response) {
          console.log(`  Status: ${error.response.status}`);
          console.log(`  Details: ${error.response.statusText}`);
        }
      } else {
        console.log(`  Error: ${error}`);
      }
    }
  }

  console.log('\n🎉 Connection test complete!\n');
  console.log('Next steps:');
  console.log('1. If all tests passed, you can use "npm run start" to run the MCP server');
  console.log('2. If tests failed, check your credentials and Nextcloud configuration');
  console.log('3. Make sure the required apps (Tasks, Calendar, Notes) are installed in Nextcloud\n');
}

testConnection().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});

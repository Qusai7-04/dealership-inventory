import path from 'node:path';

if (typeof process.loadEnvFile === 'function') {
  try {
    const repositoryRoot = path.basename(process.cwd()) === 'backend'
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    process.loadEnvFile(path.join(repositoryRoot, '.env'));
  } catch {
    // Ignore when .env does not exist
  }
}

async function checkAccount() {
  const apiKey = process.env.CAR_IMAGE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('CAR_IMAGE_API_KEY is NOT set in environment or .env');
    process.exit(1);
  }

  console.log('CAR_IMAGE_API_KEY is configured (length: ' + apiKey.trim().length + ' chars). Checking account status...');

  try {
    const response = await fetch('https://carimage.dev/api/v1/account', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    console.log(`Account endpoint response HTTP ${response.status} ${response.statusText}`);
    const remainingHeader = response.headers.get('x-credits-remaining');
    if (remainingHeader) {
      console.log(`Header X-Credits-Remaining: ${remainingHeader}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`Account check failed: status ${response.status}, body: ${text.slice(0, 200)}`);
      return;
    }

    const data = await response.json();
    console.log('Account Info:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('Account check request failed:', err.message);
  }
}

checkAccount();

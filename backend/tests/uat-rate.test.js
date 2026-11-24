import fs from 'node:fs';
process.env.RATE_LIMIT_ENABLED = 'true';
const { setupDatabase, api } = await import('./helpers.js');
test('rate limit login', async () => {
  await setupDatabase();
  const codes = [];
  for (let i = 0; i < 35; i++) codes.push((await api().post('/api/v1/auth/login').send({ email: 'a@b.test', password: 'salahsalah1' })).status);
  const first429 = codes.indexOf(429) + 1;
  fs.writeFileSync('./uat_rate.json', JSON.stringify({ first429, codes }));
});

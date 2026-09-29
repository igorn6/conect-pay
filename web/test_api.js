const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/dashboard?userId=123&userRole=GESTOR',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});
req.on('error', e => console.error('Error:', e.message));
req.end();

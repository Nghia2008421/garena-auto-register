const fs = require('fs');
const axios = require('axios');

const EMAIL_FILE = 'emails.txt';
const RESULT_FILE = 'res/result.txt';

// Utility functions
function genUsername() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genPassword() {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+-=';
  let all = letters + digits + symbols;

  while (true) {
    let pass = Array.from({ length: 12 }, () => all[Math.floor(Math.random() * all.length)]).join('');
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass) && /\d/.test(pass) && /[!@#$%^&*()_+\-=]/.test(pass)) {
      return pass;
    }
  }
}

// Mail.tm API
async function getMailToken(email, password = 'defaultpass') {
  try {
    let r1 = await axios.post('https://api.mail.tm/accounts', { address: email, password });
  } catch (e) {} // có thể đã tồn tại

  let res = await axios.post('https://api.mail.tm/token', { address: email, password });
  return res.data.token;
}

async function waitForGarenaMail(token, timeout = 60000) {
  const config = { headers: { Authorization: `Bearer ${token}` } };
  let t = Date.now();

  while (Date.now() - t < timeout) {
    let inbox = await axios.get('https://api.mail.tm/messages', config);
    let garenaMail = inbox.data['hydra:member'].find(m => m.from?.address.includes('garena'));
    if (garenaMail) {
      let mail = await axios.get(`https://api.mail.tm/messages/${garenaMail.id}`, config);
      let codeMatch = mail.data.text.match(/(\d{6})/);
      if (codeMatch) return codeMatch[1];
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error('Timeout waiting for verification code');
}

// Fake Garena register (bạn cần thay bằng request thật)
async function registerGarena(email, username, password) {
  console.log(`🔧 [Fake] Registering Garena with ${email} / ${username}`);
  await new Promise(r => setTimeout(r, 2000)); // Giả lập delay
  return true;
}

// MAIN
(async () => {
  if (!fs.existsSync('res')) fs.mkdirSync('res');

  let emails = fs.readFileSync(EMAIL_FILE, 'utf-8').split('\n').map(x => x.trim()).filter(Boolean);

  for (let email of emails) {
    try {
      let username = genUsername();
      let password = genPassword();

      console.log(`📧 Creating account for: ${email}`);

      let token = await getMailToken(email);
      await registerGarena(email, username, password);
      let code = await waitForGarenaMail(token);

      console.log(`✅ Got code: ${code} — Completing registration...`);

      // Bạn có thể thêm bước gửi code xác nhận thật ở đây

      fs.appendFileSync(RESULT_FILE, `${email} | ${username} | ${password}\n`);
      console.log(`🎉 Done: ${username} saved.`);
    } catch (err) {
      console.error(`❌ Failed with ${email}: ${err.message}`);
    }
  }
})();

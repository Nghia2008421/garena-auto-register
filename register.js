const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer');

const CONCURRENCY = 10; // Số acc chạy song song

function randomUsername() {
  return 'user' + Math.random().toString(36).substring(2, 10);
}

function randomPassword() {
  return (
    Math.random().toString(36).substring(2, 4).toUpperCase() +
    Math.random().toString(36).substring(2, 4).toLowerCase() +
    Math.floor(1000 + Math.random() * 9000) + '!'
  );
}

async function getMailToken(email, mailPassword) {
  const res = await axios.post('https://api.mail.tm/token', {
    address: email,
    password: mailPassword
  });
  return res.data.token;
}

async function getVerifyCode(token) {
  const headers = { Authorization: `Bearer ${token}` };
  let tries = 0;

  while (tries < 12) {
    const res = await axios.get('https://api.mail.tm/messages', { headers });
    const mail = res.data['hydra:member'].find(m => m.from?.address.includes('garena'));
    if (mail) {
      const content = await axios.get(`https://api.mail.tm/messages/${mail.id}`, { headers });
      const code = content.data.text.match(/\d{6}/);
      return code ? code[0] : null;
    }
    await new Promise(r => setTimeout(r, 5000));
    tries++;
  }

  throw new Error('Không nhận được mã xác nhận từ Garena');
}

async function registerGarena(email, mailPassword, index, allEmails) {
  const username = randomUsername();
  const password = randomPassword();

  try {
    const token = await getMailToken(email, mailPassword);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('https://account.garena.com/register', { timeout: 60000 });

    await page.type('input[name="email"]', email);
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    await page.type('input[name="re_password"]', password);
    await page.click('button[type="submit"]');

    const verifyCode = await getVerifyCode(token);
    await page.type('input[name="verify_code"]', verifyCode);
    await page.click('button.confirm');

    console.log(`✅ Thành công: ${email} | ${username} | ${password}`);

    // Tạo thư mục và file nếu chưa có
    if (!fs.existsSync('res')) fs.mkdirSync('res');
    const savePath = 'res/registered_accounts.txt';
    fs.appendFileSync(savePath, `${email}|${username}|${password}\n`);

    // Xóa dòng email đã dùng khỏi emails.txt
    allEmails[index] = null;
    fs.writeFileSync('emails.txt', allEmails.filter(line => line).join('\n'));

    await browser.close();
  } catch (err) {
    console.error(`❌ ${email} - lỗi: ${err.message}`);
  }
}

(async () => {
  let lines = fs.readFileSync('emails.txt', 'utf8').trim().split('\n');
  const tasks = lines.map((line, index) => {
    const [email, mailPassword] = line.trim().split('|');
    return () => registerGarena(email, mailPassword, index, lines);
  });

  // Chạy theo nhóm (batch) CONCURRENCY acc 1 lúc
  async function runBatch(tasks, batchSize) {
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize).map(fn => fn());
      await Promise.allSettled(batch); // không dừng nếu lỗi
    }
  }

  await runBatch(tasks, CONCURRENCY);
})();

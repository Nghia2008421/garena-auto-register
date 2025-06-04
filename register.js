const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer');

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
  const response = await axios.post('https://api.mail.tm/token', {
    address: email,
    password: mailPassword
  });
  return response.data.token;
}

async function getVerifyCode(token) {
  const headers = { Authorization: `Bearer ${token}` };
  let tries = 0;

  while (tries < 15) {
    const res = await axios.get('https://api.mail.tm/messages', { headers });
    const garenaMail = res.data['hydra:member'].find(m =>
      m.from && m.from.address.includes('garena')
    );

    if (garenaMail) {
      const mailContent = await axios.get(`https://api.mail.tm/messages/${garenaMail.id}`, { headers });
      const code = mailContent.data.text.match(/\d{6}/);
      if (code) return code[0];
    }

    await new Promise(r => setTimeout(r, 5000));
    tries++;
  }

  throw new Error('Không tìm thấy mã xác nhận!');
}

(async () => {
  const lines = fs.readFileSync('mails.txt', 'utf8').trim().split('\n');

  for (const line of lines) {
    if (!line.includes('|')) {
      console.log(`Bỏ qua dòng không đúng định dạng: ${line}`);
      continue;
    }
    const [email, mailPassword] = line.split('|').map(s => s.trim());

    if (!email || !mailPassword) {
      console.log(`Bỏ qua dòng thiếu email hoặc mật khẩu: ${line}`);
      continue;
    }

    const username = randomUsername();
    const password = randomPassword();

    let browser;

    try {
      const token = await getMailToken(email, mailPassword);

      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto('https://account.garena.com/register', { waitUntil: 'networkidle2' });

      await page.type('input[name="email"]', email, { delay: 100 });
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.type('input[name="password"]', password, { delay: 100 });
      await page.type('input[name="re_password"]', password, { delay: 100 });

      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);

      await page.waitForSelector('input[name="verify_code"]', { timeout: 15000 });
      const verifyCode = await getVerifyCode(token);

      await page.type('input[name="verify_code"]', verifyCode, { delay: 100 });
      await page.click('button.confirm');
      await page.waitForTimeout(5000);

      console.log(`✅ Đăng ký thành công: ${email} | ${username} | ${password}`);
    } catch (error) {
      console.error(`❌ Lỗi với email ${email}:`, error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
})();

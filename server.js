// server.js
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = 8080;

// 🔑 Hardcoded Login (Username & Password SAME)
const HARD_USERNAME = "shgshjdhghdjkjhgdhj";
const HARD_PASSWORD = "shgshjdhghdjkjhgdhj";

// 📩 Footer (auto add)
const FOOTER_ENABLED = true;
const FOOTER_TEXT = "📩 Scanned & Secured — www.avira.com";

// ================= MIDDLEWARE =================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'bulk-mailer-secret',
  resave: false,
  saveUninitialized: true
}));

// 🔒 Auth middleware
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/');
}

// ================= ROUTES =================

// Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }

  return res.json({ success: false, message: "❌ Invalid credentials" });
});

// Launcher page
app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

// ================= HELPERS =================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendBatch(transporter, mails, batchSize = 5) {
  for (let i = 0; i < mails.length; i += batchSize) {
    await Promise.allSettled(
      mails.slice(i, i + batchSize).map(m => transporter.sendMail(m))
    );
    await delay(200);
  }
}

// ================= SEND MAIL =================
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({
        success: false,
        message: "Email, password and recipients required"
      });
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    if (!recipientList.length) {
      return res.json({ success: false, message: "No valid recipients" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    const footer = FOOTER_ENABLED ? `\n\n${FOOTER_TEXT}` : "";

    const mails = recipientList.map(r => ({
      from: `"${senderName || 'Anonymous'}" <${email}>`,
      to: r,
      subject: subject || "No Subject",
      text: (message || "") + footer
    }));

    await sendBatch(transporter, mails, 5);

    return res.json({
      success: true,
      message: `✅ Mail sent to ${recipientList.length}`
    });

  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

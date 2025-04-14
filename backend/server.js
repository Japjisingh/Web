require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const PDFDocument = require('pdfkit');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const downloadLinks = new Map();

function generateLink(filePath) {
  const id = uuidv4();
  downloadLinks.set(id, { filePath, used: false, expires: Date.now() + (24 * 60 * 60 * 1000) }); // 24h expiry
  return `/download/${id}`;
}

function validateLink(id) {
  const link = downloadLinks.get(id);
  if (!link || link.used || link.expires < Date.now()) return null;
  link.used = true;
  return link.filePath;
}

function generatePDF(email, price, filePath) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text('Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`Thank you for your purchase, ${email}!`);
  doc.text(`Product: GTM Container Generator`);
  doc.text(`Amount: $${price}`);
  doc.text(`Date: ${new Date().toLocaleString()}`);

  doc.end();
}

async function trackPurchaseToGA(email) {
  try {
    await axios.post(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, {
      client_id: '555',
      events: [{
        name: 'purchase',
        params: {
          currency: 'USD',
          value: 199,
          email: email
        }
      }]
    });
    console.log('✅ Purchase event sent to GA4');
  } catch (error) {
    console.error('Google Analytics error:', error.message);
  }
}

// 📩 Handle PayPal notifications manually for now
app.post('/paypal-webhook', async (req, res) => {
  const { payer, purchase_units } = req.body.resource || {};

  if (!payer || !purchase_units) {
    return res.status(400).send('Invalid webhook data');
  }

  const email = payer.email_address;
  const filePath = path.join(__dirname, 'public', 'GTM-Import.json');
  const downloadLink = `${process.env.DOMAIN}${generateLink(filePath)}`;
  const receiptPath = path.join(__dirname, `receipt-${Date.now()}.pdf`);

  generatePDF(email, 199, receiptPath);

  const emailHtml = `
    <h2>Thank you for your purchase 🎉</h2>
    <p>Your GTM container is ready:</p>
    <p><a href="${downloadLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Container</a></p>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your GTM Container is Ready!',
    html: emailHtml,
    attachments: [{
      filename: 'receipt.pdf',
      path: receiptPath
    }]
  });

  await trackPurchaseToGA(email);

  fs.unlink(receiptPath, (err) => {
    if (err) console.error('Failed to delete receipt:', err);
  });

  console.log(`✅ Confirmation email sent to ${email}`);
  res.json({ received: true });
});

// 📦 Secure download route
app.get('/download/:id', (req, res) => {
  const filePath = validateLink(req.params.id);
  if (!filePath) return res.status(403).send('Link invalid or expired.');
  res.download(filePath);
});

// ✅ Start server
app.listen(4242, () => console.log('🚀 Backend running on port 4242'));

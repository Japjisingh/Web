// server.js

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./utils/mailer');
const { generateLink, validateLink } = require('./utils/generateSignedLink');
const axios = require('axios');
const PDFDocument = require('pdfkit');

const app = express();
app.use(bodyParser.raw({ type: 'application/json' }));
app.use(express.static('public')); // Optional: serve static files

// 📩 Generate PDF receipt
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

// 📊 Google Analytics server-side tracking
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

// 🧩 Stripe webhook endpoint
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    console.log(`💰 Payment received from ${email}`);

    // Generate one-time secure link
    const filePath = path.join(__dirname, 'public', 'GTM-Import.json'); // make sure the JSON is in /public/
    const downloadLink = `${process.env.DOMAIN}${generateLink(filePath)}`;

    // Generate PDF receipt
    const receiptPath = path.join(__dirname, `receipt-${Date.now()}.pdf`);
    generatePDF(email, 199, receiptPath);

    // Send confirmation email
    const receiptTemplate = fs.readFileSync(path.join(__dirname, 'template/receiptTemplate.html'), 'utf8');
    const emailHtml = receiptTemplate.replace('{{downloadLink}}', downloadLink);

    await sendEmail(email, 'Your GTM Container is Ready!', emailHtml, receiptPath);

    // Track purchase to Google Analytics
    await trackPurchaseToGA(email);

    // Clean up: Optionally delete receipt file after email sent
    fs.unlink(receiptPath, (err) => {
      if (err) console.error('Failed to delete receipt:', err);
    });

    console.log('✅ Email and tracking completed');
  }

  res.json({ received: true });
});

// 📦 Secure one-time download endpoint
app.get('/download/:id', (req, res) => {
  const filePath = validateLink(req.params.id);
  if (!filePath) {
    return res.status(403).send('Link is invalid or expired.');
  }
  res.download(filePath);
});

// ✅ Server start
app.listen(4242, () => console.log('🚀 Server running on port 4242'));

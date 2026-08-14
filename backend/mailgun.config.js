const formData = require('form-data');
const Mailgun = require('mailgun.js');
require('dotenv').config();

const mailgun = new Mailgun(formData);
let mg;
const DOMAIN = process.env.MAILGUN_DOMAIN || '';
const FROM_EMAIL = process.env.MAILGUN_FROM || (DOMAIN ? `Study Mate <postmaster@${DOMAIN}>` : 'Study Mate <no-reply@example.com>');

if (process.env.MAILGUN_API_KEY) {
  mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });
} else {
  // Provide a safe stub so requiring this module doesn't crash when the API key is absent.
  mg = {
    messages: {
      create: async () => {
        throw new Error('Mailgun API key not configured. Set MAILGUN_API_KEY in environment.');
      }
    }
  };
}

module.exports = { mg, DOMAIN, FROM_EMAIL };
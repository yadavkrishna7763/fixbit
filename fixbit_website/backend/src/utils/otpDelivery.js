const { maskContact } = require('./contact');

const EMAIL_PROVIDER = String(process.env.OTP_EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? 'resend' : 'console')).toLowerCase();
const SMS_PROVIDER = String(process.env.OTP_SMS_PROVIDER || 'console').toLowerCase();
const SMS_ENABLED = String(process.env.OTP_SMS_ENABLED || (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true';

function isEmailChannelAvailable() {
  if (EMAIL_PROVIDER === 'console') return true;
  if (EMAIL_PROVIDER === 'resend') {
    return Boolean(process.env.RESEND_API_KEY && process.env.OTP_EMAIL_FROM);
  }
  return false;
}

function isPhoneChannelAvailable() {
  if (!SMS_ENABLED) return false;
  if (SMS_PROVIDER === 'console') return true;
  if (SMS_PROVIDER === 'twilio') {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)
    );
  }
  return false;
}

function buildOtpMessage(purpose, code) {
  if (purpose === 'register') {
    return {
      subject: 'Verify your FixBit account',
      text: `Your FixBit verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your FixBit verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
    };
  }

  return {
    subject: 'Reset your FixBit password',
    text: `Your FixBit password reset code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your FixBit password reset code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
  };
}

async function sendViaConsole(channel, target, purpose, code) {
  console.log(`[FixBit OTP] ${purpose} ${channel} -> ${target}: ${code}`);
}

async function sendViaResend(target, message) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.OTP_EMAIL_FROM,
      to: [target],
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to send email OTP');
  }
}

async function sendViaTwilio(target, message) {
  const credentials = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const body = new URLSearchParams({
    To: target,
    Body: message.text
  });

  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    body.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    body.set('From', process.env.TWILIO_FROM_NUMBER);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to send SMS OTP');
  }
}

async function sendOtp({ channel, target, purpose, code }) {
  const message = buildOtpMessage(purpose, code);

  if (channel === 'email') {
    if (EMAIL_PROVIDER === 'resend') {
      await sendViaResend(target, message);
    } else {
      await sendViaConsole(channel, target, purpose, code);
    }
    return;
  }

  if (channel === 'phone') {
    if (!SMS_ENABLED) {
      throw new Error('Phone OTP is not enabled');
    }
    if (SMS_PROVIDER === 'twilio') {
      await sendViaTwilio(target, message);
    } else {
      await sendViaConsole(channel, target, purpose, code);
    }
    return;
  }

  throw new Error('Unsupported OTP channel');
}

function isOtpChannelAvailable(channel) {
  return channel === 'email' ? isEmailChannelAvailable() : isPhoneChannelAvailable();
}

function getMaskedOtpTarget(channel, target) {
  return maskContact(channel, target);
}

module.exports = {
  isOtpChannelAvailable,
  getMaskedOtpTarget,
  sendOtp
};

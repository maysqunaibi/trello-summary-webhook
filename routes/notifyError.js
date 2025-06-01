// helpers/notifyError.js

const { sendEmail } = require("../helpers/email");

async function notifyError({ context, error }) {
  const subject = `🚨 Error in Trello Automation (${context})`;

  const body = `
Hi,

An error occurred in the Trello automation system.

Context: ${context}
Time: ${new Date().toLocaleString()}
Error Message: ${error.message}

Stack Trace:
${error.stack}

Please investigate.

Best,
Your Trello Bot
  `.trim();

  await sendEmail({ subject, body, to: process.env.EMAIL_TO_ERROR });
}

module.exports = { notifyError };

const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email
 * @param {Object} options
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email text body
 */
async function sendEmail({ subject, body, to }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject,
      text: body,
    });
    console.log("✅Email sent");
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
}

module.exports = { sendEmail };

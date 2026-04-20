const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendReportEmail(content, isTest = false) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: isTest ? process.env.EMAIL_TEST : process.env.EMAIL_TO,
    cc: isTest ? "" : process.env.EMAIL_CC,
    subject: `Weekly Report - ${new Date().toLocaleDateString()} ${isTest ? "[TEST]" : ""}`,
    text: content,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return { success: true, message: info.response };
  } catch (error) {
    console.error("Email Error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendReportEmail };

const { sendEmail } = require("../../controllers/emailController");

async function processQueueEmail(message) {
  try {
    await sendEmail(
      message?.to,
      message?.type,
      message?.subject,
      message?.params
    );
    return { status: "success" };
  } catch (error) {
    console.log(error);
    return { status: "failed" };
  }
}

module.exports = { processQueueEmail };

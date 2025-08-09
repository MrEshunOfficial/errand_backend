import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config();

// Validate environment variables
if (!process.env.MAILTRAP_TOKEN) {
  throw new Error("MAILTRAP_TOKEN is not set");
}

if (!process.env.MAILTRAP_ENDPOINT) {
  throw new Error("MAILTRAP_ENDPOINT is not set");
}

const client = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN,
});

const sender = {
  email: "hello@demomailtrap.com",
  name: "Mailtrap",
};

const recipients = [
  {
    email: "mrkwesieshun@gmail.com",
  },
];

async function sendEmail() {
  try {
    const result = await client.send({
      from: sender,
      to: recipients,
      subject: "You are awesome!",
      text: "Congrats for sending test email with Mailtrap!",
      category: "Integration Test",
    });

    console.log("Email sent successfully:", result);
  } catch (error) {
    console.error("Failed to send email:", error);

    // More specific error handling
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
  }
}

sendEmail();

// backend/utils/sendEmail.ts
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

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  category?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    const recipients = [
      {
        email: "christophereshun91@gmail.com",
      },
    ];

    const result = await client.send({
      from: sender,
      to: recipients,
      subject: options.subject,
      html: options.html,
      text: options.text,
      category: options.category || "Application Email",
    });

    console.log("Email sent successfully:", result);
  } catch (error) {
    console.error("Failed to send email:", error);

    // More specific error handling
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      throw new Error(`Email sending failed: ${error.message}`);
    }

    throw new Error("Email sending failed with unknown error");
  }
}

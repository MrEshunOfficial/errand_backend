// utils/sendEmail.ts
import { MailtrapClient } from "mailtrap";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const client = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN!,
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const sender = {
    email: process.env.FROM_EMAIL!,
    name: process.env.FROM_NAME || "Your App Name",
  };

  const recipients = [
    {
      email: options.to,
    },
  ];

  await client.send({
    from: sender,
    to: recipients,
    subject: options.subject,
    html: options.html,
  });
};

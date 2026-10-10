import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

export class MailError extends Error {
  constructor(message, code = "MAIL_FAILED") {
    super(message);
    this.code = code;
    this.expose = true;
  }
}

function loadMailConfig(rootDir) {
  const fromEnv = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 0),
    secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_PORT === "465",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  };
  if (fromEnv.host && fromEnv.user && fromEnv.pass) {
    return { ...fromEnv, port: fromEnv.port || 465, from: fromEnv.from || fromEnv.user };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "mail.json"), "utf8"));
    if (!raw.host || !raw.user || !raw.pass) return null;
    return {
      host: raw.host,
      port: Number(raw.port || 465),
      secure: raw.secure !== false,
      user: raw.user,
      pass: raw.pass,
      from: raw.from || raw.user
    };
  } catch {
    return null;
  }
}

export async function sendVerifyCode(rootDir, { email, username, code }) {
  const config = loadMailConfig(rootDir);
  if (!config) {
    throw new MailError("还没配置发信邮箱，无法发送验证码。请复制 data/mail.example.json 为 data/mail.json 并填入邮箱授权码。", "MAIL_NOT_CONFIGURED");
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure || config.port === 465,
    auth: { user: config.user, pass: config.pass }
  });
  try {
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: "刮开彩运博物馆 · 注册验证码",
      text: `${username}，你的注册验证码是 ${code}，10 分钟内有效。之后可用这个邮箱或账号登录。如果不是你本人在注册，请忽略这封信。`,
      html: `<p>${username}，你的注册验证码是：</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>10 分钟内有效。之后可用这个邮箱或账号登录。如果不是你本人在注册，请忽略这封信。</p>`
    });
  } catch {
    throw new MailError("验证码发送失败，请检查邮箱地址或发信配置");
  }
}

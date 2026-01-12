import { Request, Response } from "express";
import nodemailer from "nodemailer";

// Create a transporter for sending emails
const createTransporter = () => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    console.warn(
      "Gmail credentials not configured. Bug reports will be logged but not emailed."
    );
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
};

export async function handleBugReport(req: Request, res: Response) {
  try {
    const { title, description, email, severity, image } = req.body;

    // Validate required fields
    if (!title || !description || !email || !severity) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Log the bug report
    console.log("Bug Report Received:", {
      title,
      description,
      email,
      severity,
      hasImage: !!image,
      timestamp: new Date().toISOString(),
    });

    // Prepare email attachments
    const attachments = [];
    if (image) {
      // Image is base64 encoded string with data URL prefix
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      attachments.push({
        filename: `bug-report-screenshot-${Date.now()}.png`,
        content: Buffer.from(base64Data, "base64"),
        contentType: "image/png",
      });
    }

    // Send email if credentials are configured
    const transporter = createTransporter();
    if (transporter) {
      try {
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: "iclassifierteam@gmail.com",
          subject: `[${severity.toUpperCase()}] Bug Report: ${title}`,
          html: `
            <h2>New Bug Report</h2>
            <p><strong>Severity Level:</strong> <span style="color: ${
              severity === "high"
                ? "red"
                : severity === "medium"
                  ? "orange"
                  : "green"
            }; font-weight: bold;">${severity.toUpperCase()}</span></p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Reporter Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <hr style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="white-space: pre-wrap;">${description.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>
            <hr style="margin: 20px 0;">
            <p><small>Submitted on: ${new Date().toISOString()}</small></p>
            ${image ? '<p><small>Screenshot attached</small></p>' : ""}
          `,
          attachments,
        };

        await transporter.sendMail(mailOptions);
        console.log("Bug report email sent successfully");
      } catch (emailError) {
        console.error("Error sending bug report email:", emailError);
        // Don't fail the request if email sending fails, just log it
      }
    }

    res.json({
      success: true,
      message: "Bug report submitted successfully",
    });
  } catch (error) {
    console.error("Error processing bug report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bug report",
    });
  }
}

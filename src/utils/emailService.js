const nodemailer = require('nodemailer');
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');

// Initialize SES Client
const ses = new SESClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Create transporter using SES
const transporter = nodemailer.createTransport({
    SES: { ses, aws: { SendRawEmailCommand } },
});

const APP_NAME = process.env.APP_NAME || 'Virpanix';
const FROM_EMAIL = process.env.EMAIL_FROM || 'no-reply@virpanix.com';

/**
 * Send account activation email (Registration Email)
 * @param {string} email - Recipient email
 * @param {string} token - Activation token
 * @param {string} name - User's name
 */
const sendActivationEmail = async (email, token, name) => {
    try {
        const activationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/activate?token=${token}`;

        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: `Welcome to ${APP_NAME} - Verify Your Email`,
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 28px;">Welcome, ${name}!</h1>
            </div>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Thank you for joining <strong>${APP_NAME}</strong>. We're excited to have you on board! 
                To get started, please confirm your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${activationLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Confirm Email Address</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${activationLink}" style="color: #4f46e5; word-break: break-all;">${activationLink}</a>
            </p>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 0;">
                    &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                </p>
            </div>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Activation email sent via SES: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending activation email via SES:', error);
        return false;
    }
};

/**
 * Send Account Confirmation Success Email
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
const sendAccountConfirmationEmail = async (email, name) => {
    try {
        const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Account Confirmed - Welcome to the Platform',
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #ecfdf5; color: #059669; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; font-size: 30px; margin: 0 auto 20px;">✓</div>
                <h1 style="color: #059669; margin: 0; font-size: 28px;">Account Confirmed!</h1>
            </div>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Hello ${name},<br><br>
                Great news! Your account has been successfully verified. You now have full access to all features of the <strong>${APP_NAME}</strong> platform.
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${loginLink}" style="background-color: #059669; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Login to Your Dashboard</a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 0;">
                    &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                </p>
            </div>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent via SES: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending confirmation email via SES:', error);
        return false;
    }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} name - User's name
 */
const sendResetPasswordEmail = async (email, token, name) => {
    try {
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Reset Your Password',
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #4f46e5; text-align: center;">Password Reset Request</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Hello ${name},<br><br>
                We received a request to reset the password for your account. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
                If you didn't request a password reset, you can safely ignore this email. This link will expire in 1 hour.
            </p>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 0;">
                    &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                </p>
            </div>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Reset password email sent via SES: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending reset password email via SES:', error);
        return false;
    }
};

/**
 * Send property recommendation email to a lead
 */
const sendPropertyRecommendationEmail = async (leadEmail, leadName, properties) => {
    try {
        const propertyHtml = properties.map(p => `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <h3 style="margin-top: 0; color: #111827;">${p.title}</h3>
                <p style="margin: 5px 0; font-size: 14px; color: #4b5563;">${p.city} | ${p.propertyType}</p>
                <div style="margin: 10px 0;">
                    <strong style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Available Units:</strong>
                    <ul style="padding-left: 20px; margin: 5px 0;">
                        ${p.units.slice(0, 3).map(u => `
                            <li style="font-size: 14px; color: #111827;">${u.unitCode}: <strong>$${Number(u.price).toLocaleString()}</strong></li>
                        `).join('')}
                    </ul>
                </div>
                <a href="${process.env.FRONTEND_URL}/properties/${p.id}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bold;">View Details</a>
            </div>
        `).join('');

        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: leadEmail,
            subject: 'Exciting Property Matches Just for You!',
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #4f46e5; text-align: center;">Top Matches Found!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Hello ${leadName},
            <br><br>
            Based on your recent interest and activity on our platform, our AI has hand-picked these properties that we think you'll love:
            </p>
            
            ${propertyHtml}

            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            If you'd like to see more or schedule a viewing, please reply to this email or contact your agent.
            </p>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 0;">
                    &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                </p>
            </div>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Recommendation email sent via SES: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending recommendation email via SES:', error);
        return false;
    }
};

/**
 * Send Booking Notification Email
 */
const sendBookingEmail = async (email, name, bookingDetails) => {
    try {
        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'New Booking Confirmation',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Booking Confirmed!</h2>
            <p>Hello ${name},</p>
            <p>Your booking for <strong>${bookingDetails.unitCode}</strong> at <strong>${bookingDetails.propertyName}</strong> has been received.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.date}</p>
                <p style="margin: 5px 0;"><strong>Total Price:</strong> ${bookingDetails.price}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${bookingDetails.status}</p>
            </div>
            <p>Please log in to your dashboard for more details.</p>
        </div>
        `
        };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending booking email:', error);
        return false;
    }
};

/**
 * Send Lead Notification Email
 */
const sendLeadEmail = async (email, name, leadDetails) => {
    try {
        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'New Inquiry Received',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">New Lead!</h2>
            <p>Hello Admin,</p>
            <p>A new inquiry has been received from <strong>${name}</strong>.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${leadDetails.email}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${leadDetails.phone}</p>
                <p style="margin: 5px 0;"><strong>Message:</strong> ${leadDetails.message}</p>
            </div>
        </div>
        `
        };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending lead email:', error);
        return false;
    }
};

/**
 * Send custom template email
 */
const sendTemplateEmail = async (email, subject, html) => {
    try {
        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: email,
            subject: subject,
            html: html
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Template email sent to ${email}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[Email Service] Error sending template email:', error);
        return false;
    }
};

module.exports = {
    sendActivationEmail,
    sendAccountConfirmationEmail,
    sendResetPasswordEmail,
    sendPropertyRecommendationEmail,
    sendBookingEmail,
    sendLeadEmail,
    sendTemplateEmail
};

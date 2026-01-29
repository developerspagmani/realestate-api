const nodemailer = require('nodemailer');

// Create transporter
// Ideally, use environment variables for these credentials
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // Default to gmail or configure SMTP
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send account activation email
 * @param {string} email - Recipient email
 * @param {string} token - Activation token
 * @param {string} name - User's name
 */
const sendActivationEmail = async (email, token, name) => {
    try {
        // Construct the activation link
        // Ensure FRONTEND_URL is defined in .env, e.g., http://localhost:3000
        const activationLink = `${process.env.FRONTEND_URL}/activate?token=${token}`;

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'RealEstate Admin'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Activate Your Account - RealEstate Platform',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #6366f1; text-align: center;">Welcome to Our Platform, ${name}!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
            Thank you for registering. To complete your account setup and start using the platform, please verify your email address.
            </p>
            <div style="text-align: center; margin: 30px 0;">
            <a href="${activationLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Verify Email & Activate Account</a>
            </div>
            <p style="font-size: 14px; color: #666;">
            If you didn't create an account, you can safely ignore this email.
            <br>
            <br>
            This link will expire in 24 hours.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'RealEstate Platform'}. All rights reserved.
            </p>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Activation email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending activation email:', error);
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
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'RealEstate Admin'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Your Password - RealEstate Platform',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #6366f1; text-align: center;">Password Reset Request</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
            Hello ${name},
            <br><br>
            We received a request to reset the password for your account. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #666;">
            If you didn't request a password reset, you can safely ignore this email.
            <br>
            <br>
            This link will expire in 1 hour.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'RealEstate Platform'}. All rights reserved.
            </p>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Reset password email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending reset password email:', error);
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
                <a href="${process.env.FRONTEND_URL}/properties/${p.id}" style="display: inline-block; background-color: #6366f1; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bold;">View Details</a>
            </div>
        `).join('');

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'RealEstate Admin'}" <${process.env.EMAIL_USER}>`,
            to: leadEmail,
            subject: 'Exciting Property Matches Just for You!',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #6366f1; text-align: center;">Top Matches Found!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
            Hello ${leadName},
            <br><br>
            Based on your recent interest and activity on our platform, our AI has hand-picked these properties that we think you'll love:
            </p>
            
            ${propertyHtml}

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
            If you'd like to see more or schedule a viewing, please reply to this email or contact your agent.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'RealEstate Platform'}. All rights reserved.
            </p>
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Recommendation email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending recommendation email:', error);
        return false;
    }
};

module.exports = {
    sendActivationEmail,
    sendResetPasswordEmail,
    sendPropertyRecommendationEmail
};

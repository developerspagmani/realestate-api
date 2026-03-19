const nodemailer = require('nodemailer');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');

// Initialize SES Client
const ses = new SESv2Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Create transporter using SES
const transporter = nodemailer.createTransport({
    SES: { sesClient: ses, SendEmailCommand },
});

const APP_NAME = process.env.APP_NAME || 'Virpanix';
const FROM_EMAIL = process.env.EMAIL_FROM || 'no-reply@virpanix.com';

/**
 * Helper to get email theme configuration
 */
const getEmailTheme = (tenantInfo = {}) => {
    const primaryColor = tenantInfo.emailSkinColor || '#4f46e5';
    const domain = tenantInfo.customDomain ? `https://${tenantInfo.customDomain}` : (process.env.FRONTEND_URL || 'http://localhost:3000');
    const appName = tenantInfo.name || APP_NAME;
    const showFooter = tenantInfo.showFooter !== undefined ? tenantInfo.showFooter : true;
    const footerText = tenantInfo.footerText || '';
    const currencySymbol = tenantInfo.currencySymbol || '$';
    
    // Social Links
    const facebookUrl = tenantInfo.facebookUrl || '';
    const twitterUrl = tenantInfo.twitterUrl || '';
    const instagramUrl = tenantInfo.instagramUrl || '';
    const linkedinUrl = tenantInfo.linkedinUrl || '';
    const showUnsubscribe = tenantInfo.showUnsubscribe !== undefined ? tenantInfo.showUnsubscribe : true;
    const unsubscribeText = tenantInfo.unsubscribeText || 'Unsubscribe';
    const unsubscribeUrl = tenantInfo.unsubscribeUrl || `${domain}/unsubscribe`;

    let socialHtml = '';
    const iconStyle = `margin: 0 8px; text-decoration: none; display: inline-block;`;
    
    if (facebookUrl) socialHtml += `<a href="${facebookUrl}" style="${iconStyle}"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="20" height="20" alt="FB"></a>`;
    if (twitterUrl) socialHtml += `<a href="${twitterUrl}" style="${iconStyle}"><img src="https://cdn-icons-png.flaticon.com/512/5968/5968830.png" width="20" height="20" alt="X"></a>`;
    if (instagramUrl) socialHtml += `<a href="${instagramUrl}" style="${iconStyle}"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="20" height="20" alt="IG"></a>`;
    if (linkedinUrl) socialHtml += `<a href="${linkedinUrl}" style="${iconStyle}"><img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" width="20" height="20" alt="IN"></a>`;

    if (socialHtml) {
        socialHtml = `<div style="margin-bottom: 20px; text-align: center;">${socialHtml}</div>`;
    }

    return {
        primaryColor,
        appName,
        domain,
        showFooter,
        footerText,
        currencySymbol,
        socialHtml,
        showUnsubscribe,
        unsubscribeText,
        unsubscribeUrl,
        styles: {
            container: `font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'Inter'; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;`,
            header: `text-align: center; margin-bottom: 30px;`,
            h1: `color: ${primaryColor}; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;`,
            p: `font-size: 16px; line-height: 1.6; color: #374151;`,
            button: `background-color: ${primaryColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);`,
            footer: `margin-top: 40px; padding-top: 25px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;`
        }
    };
};

/**
 * Send account activation email (Registration Email)
 */
const sendActivationEmail = async (email, token, name, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const activationLink = `${theme.domain}/activate?token=${token}`;

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: `Welcome to ${theme.appName} - Verify Your Email`,
            html: `
        <div style="${theme.styles.container}">
            <div style="${theme.styles.header}">
                <h1 style="${theme.styles.h1}">Welcome, ${name}!</h1>
            </div>
            <p style="${theme.styles.p}">
                Thank you for joining <strong>${theme.appName}</strong>. We're excited to have you on board! 
                To get started, please confirm your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${activationLink}" style="${theme.styles.button}">Confirm Email Address</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${activationLink}" style="color: ${theme.primaryColor}; word-break: break-all;">${activationLink}</a>
            </p>
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
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
 */
const sendAccountConfirmationEmail = async (email, name, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const loginLink = `${theme.domain}/login`;

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Account Confirmed - Welcome to the Platform',
            html: `
        <div style="${theme.styles.container}">
            <div style="${theme.styles.header}">
                <div style="background-color: #ecfdf5; color: #059669; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; font-size: 30px; margin: 0 auto 20px;">✓</div>
                <h1 style="color: #059669; margin: 0; font-size: 28px;">Account Confirmed!</h1>
            </div>
            <p style="${theme.styles.p}">
                Hello ${name},<br><br>
                Great news! Your account has been successfully verified. You now have full access to all features of the <strong>${theme.appName}</strong> platform.
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${loginLink}" style="background-color: #059669; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Login to Your Dashboard</a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
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
 */
const sendResetPasswordEmail = async (email, token, name, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const resetLink = `${theme.domain}/reset-password?token=${token}`;

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Reset Your Password',
            html: `
        <div style="${theme.styles.container}">
            <h2 style="color: ${theme.primaryColor}; text-align: center;">Password Reset Request</h2>
            <p style="${theme.styles.p}">
                Hello ${name},<br><br>
                We received a request to reset the password for your account. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${resetLink}" style="${theme.styles.button}">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
                If you didn't request a password reset, you can safely ignore this email. This link will expire in 1 hour.
            </p>
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
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
const sendPropertyRecommendationEmail = async (leadEmail, leadName, properties, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const symbol = tenantInfo.currencySymbol || '$';
        
        const propertyHtml = properties.map(p => {
            const mainImage = p.mainImage?.url || 'https://via.placeholder.com/600x400?text=Property+Image';
            
            // Link logic: Owner Site -> Company Site -> Tenant Site -> Default Domain
            const ownerWebsite = p.owner?.website || p.owner?.companyWebsite || p.website;
            const baseUrl = ownerWebsite ? (ownerWebsite.startsWith('http') ? ownerWebsite : `https://${ownerWebsite}`) : theme.domain;
            const propertyLink = baseUrl.includes('/properties/') ? baseUrl : `${baseUrl}/properties/${p.slug || p.id}`;
            
            // Format price range safely
            const prices = (p.units || [])
                .map(u => Number(u.price) || Number(u.unitPricing?.[0]?.price) || null)
                .filter(pr => pr !== null && pr > 0);
            
            const priceRange = prices.length > 0
                ? (prices.length === 1 
                    ? `${symbol}${prices[0].toLocaleString()}` 
                    : `${symbol}${Math.min(...prices).toLocaleString()} - ${symbol}${Math.max(...prices).toLocaleString()}`)
                : 'Price on Request';

            return `
            <div style="margin-bottom: 30px; border-radius: 16px; overflow: hidden; background-color: #ffffff; border: 1px solid #eef2f6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <img src="${mainImage}" alt="${p.title}" style="width: 100%; height: 200px; object-fit: cover;">
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">${p.title || 'Exclusive Offering'}</h3>
                        <span style="background-color: #f1f5f9; color: ${theme.primaryColor}; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${p.listingType || 'Investment'}</span>
                    </div>
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b;">
                        📍 ${p.city || 'Prime Location'}${p.state ? `, ${p.state}` : ''}
                    </p>
                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        <div style="font-size: 13px; color: #475569;"><strong>${p.bedrooms || '--'}</strong> Beds</div>
                        <div style="font-size: 13px; color: #475569;"><strong>${p.bathrooms || '--'}</strong> Baths</div>
                        <div style="font-size: 13px; color: #475569;"><strong>${(p.area || 0).toLocaleString()}</strong> Sqft</div>
                    </div>
                    <div style="border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: ${theme.primaryColor}; font-size: 18px; font-weight: 800;">${priceRange}</div>
                        <a href="${propertyLink}" style="background-color: ${theme.primaryColor}; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">View Details</a>
                    </div>
                </div>
            </div>
        `}).join('');

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: leadEmail,
            subject: `Premium Property Matches in ${properties[0]?.city || 'your area'}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
            </style>
        </head>
        <body>
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="color: ${theme.primaryColor}; font-size: 24px; font-weight: 900; letter-spacing: -0.025em; margin-bottom: 8px;">${theme.appName.toUpperCase()}</div>
                    <div style="height: 2px; width: 40px; background-color: ${theme.primaryColor}; margin: 0 auto;"></div>
                </div>

                <div style="background-color: #ffffff; border-radius: 20px; padding: 40px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                    <h1 style="color: #0f172a; font-size: 28px; font-weight: 800; text-align: center; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.025em;">Selected for You</h1>
                    <p style="font-size: 16px; color: #64748b; text-align: center; margin-bottom: 40px;">Hello ${leadName}, based on your preferences, we've identified these premium opportunities that align with your goals.</p>
                    
                    ${propertyHtml}

                    <div style="text-align: center; margin-top: 20px;">
                        <p style="font-size: 14px; color: #94a3b8;">Want to adjust your preferences?<br>Reply to this email or contact your personal advisor.</p>
                    </div>
                </div>

                ${theme.showFooter ? `
                <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    ${theme.socialHtml}
                    <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                    ${theme.showUnsubscribe ? `<p style="margin-top: 10px;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
                </div>
                ` : ''}
            </div>
        </body>
        </html>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Recommendation sent to ${leadEmail} (Properties: ${properties.length})`);
        return true;
    } catch (error) {
        console.error('Error sending recommendation email:', error);
        return false;
    }
};

/**
 * Send Booking Notification Email
 */
const sendBookingEmail = async (email, name, bookingDetails, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'New Booking Confirmation',
            html: `
        <div style="${theme.styles.container}">
            <h2 style="color: ${theme.primaryColor};">Booking Confirmed!</h2>
            <p style="${theme.styles.p}">Hello ${name},</p>
            <p style="${theme.styles.p}">Your booking for <strong>${bookingDetails.unitCode}</strong> at <strong>${bookingDetails.propertyName}</strong> has been received.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.date}</p>
                <p style="margin: 5px 0;"><strong>Total Price:</strong> ${bookingDetails.price}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${bookingDetails.status}</p>
            </div>
            ${bookingDetails.agentInfo ? `
            <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
                <h4 style="color: ${theme.primaryColor}; margin-bottom: 10px;">Your Assigned Representative</h4>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${bookingDetails.agentInfo.name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${bookingDetails.agentInfo.email}</p>
                ${bookingDetails.agentInfo.phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${bookingDetails.agentInfo.phone}</p>` : ''}
            </div>
            ` : ''}
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
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
const sendLeadEmail = async (email, name, leadDetails, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: 'New Inquiry Received',
            html: `
        <div style="${theme.styles.container}">
            <h2 style="color: ${theme.primaryColor};">New Lead!</h2>
            <p style="${theme.styles.p}">Hello,</p>
            <p style="${theme.styles.p}">A new inquiry has been received from <strong>${name}</strong>.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${leadDetails.email}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${leadDetails.phone}</p>
                <p style="margin: 5px 0;"><strong>Message:</strong> ${leadDetails.message}</p>
            </div>
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
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
 * Send Task Assignment Email to Agent
 */
const sendTaskAssignmentEmail = async (email, name, taskDetails, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const priorityLabel = taskDetails.priority === 3 ? 'High' : (taskDetails.priority === 2 ? 'Medium' : 'Low');
        const priorityColor = taskDetails.priority === 3 ? '#ef4444' : (taskDetails.priority === 2 ? '#f59e0b' : theme.primaryColor);

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: `New Task Assigned: ${taskDetails.title}`,
            html: `
        <div style="${theme.styles.container}">
            <div style="${theme.styles.header}">
                <h2 style="color: ${theme.primaryColor}; margin: 0;">New Task Assignment</h2>
                <p style="color: #6b7280; margin-top: 5px;">A new priority task has been assigned to you.</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 25px; border-radius: 10px; border-left: 4px solid ${theme.primaryColor}; margin-bottom: 25px;">
                <h3 style="margin-top: 0; color: #111827; font-size: 18px;">${taskDetails.title}</h3>
                <p style="color: #4b5563; line-height: 1.5;">${taskDetails.description || 'No additional instructions.'}</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                    <div>
                        <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block;">Priority</span>
                        <span style="color: ${priorityColor}; font-weight: 600;">${priorityLabel}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block;">Due Date</span>
                        <span style="color: #111827; font-weight: 600;">${taskDetails.dueDate ? new Date(taskDetails.dueDate).toLocaleDateString() : 'As soon as possible'}</span>
                    </div>
                </div>
            </div>

            ${taskDetails.leadName ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px;">
                <h4 style="margin: 0; color: #1e40af; font-size: 14px;">LEAD CONTEXT</h4>
                <p style="margin: 5px 0 0 0; color: #1e3a8a; font-weight: bold;">${taskDetails.leadName}</p>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 35px;">
                <a href="${theme.domain}/realestate-agent/tasks" style="${theme.styles.button}">View Task in Portal</a>
            </div>
            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
        </div>
        `
        };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending task assignment email:', error);
        return false;
    }
};

/**
 * Send custom template email
 */
const sendTemplateEmail = async (email, subject, html, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
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

/**
 * Send Agent Credentials Email
 */
const sendAgentCredentialsEmail = async (email, name, username, password, tenantInfo = {}) => {
    try {
        const theme = getEmailTheme(tenantInfo);
        const loginLink = `${theme.domain}/login`;

        const mailOptions = {
            from: `"${theme.appName}" <${FROM_EMAIL}>`,
            to: email,
            subject: `Your Agent Account Credentials - ${theme.appName}`,
            html: `
        <div style="${theme.styles.container}">
            <div style="${theme.styles.header}">
                <h1 style="${theme.styles.h1}">Welcome, ${name}!</h1>
                <p style="color: #6b7280; margin-top: 5px;">Your agent profile has been successfully created.</p>
            </div>
            
            <p style="${theme.styles.p}">
                Your account is ready for use. Please use the credentials below to log in:
            </p>
            
            <div style="background-color: #f9fafb; padding: 25px; border-radius: 10px; border-left: 4px solid ${theme.primaryColor}; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                    <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block;">Login URL</span>
                    <a href="${loginLink}" style="color: ${theme.primaryColor}; font-weight: 600; text-decoration: none;">${loginLink}</a>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block;">Username / Phone</span>
                    <span style="color: #111827; font-weight: 600; font-size: 16px;">${username}</span>
                </div>
                <div>
                    <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block;">Temporary Password</span>
                    <span style="color: #111827; font-weight: 600; font-size: 16px; font-family: monospace;">${password}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 35px;">
                <a href="${loginLink}" style="${theme.styles.button}">Login Now</a>
            </div>

            ${theme.showFooter ? `
            <div style="${theme.styles.footer}">
                ${theme.socialHtml}
                <p style="margin: 0;">${theme.footerText || `&copy; ${new Date().getFullYear()} ${theme.appName}. All rights reserved.`}</p>
                ${theme.showUnsubscribe ? `<p style="margin: 15px 0 0 0;"><a href="${theme.unsubscribeUrl}" style="color: ${theme.primaryColor}; text-decoration: underline;">${theme.unsubscribeText}</a></p>` : ''}
            </div>
            ` : ''}
        </div>
        `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Agent credentials email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending agent credentials email:', error);
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
    sendTaskAssignmentEmail,
    sendTemplateEmail,
    sendAgentCredentialsEmail
};

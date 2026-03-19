const { prisma } = require('../config/database');

// Get all email templates
const getAllTemplates = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const templates = await prisma.emailTemplate.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: templates });
    } catch (error) {
        console.error('Get all templates error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching templates' });
    }
};

// Create email template
const createTemplate = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { name, subject, content, type, isDefault } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const template = await prisma.emailTemplate.create({
            data: {
                name,
                subject,
                content,
                type: type || 'email',
                isDefault: !!isDefault,
                tenantId
            }
        });

        res.status(201).json({ success: true, message: 'Template created successfully', data: template });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ success: false, message: 'Server error creating template' });
    }
};

// Delete template
const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        await prisma.emailTemplate.deleteMany({
            where: { id, tenantId }
        });

        res.status(200).json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting template' });
    }
};

// Update template
const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { name, subject, content, type, isDefault } = req.body;

        const template = await prisma.emailTemplate.updateMany({
            where: { id, tenantId },
            data: {
                ...(name && { name }),
                ...(subject && { subject }),
                ...(content !== undefined && { content }),
                ...(type && { type }),
                ...(isDefault !== undefined && { isDefault: !!isDefault })
            }
        });

        res.status(200).json({ success: true, message: 'Template updated successfully', data: template });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ success: false, message: 'Server error updating template' });
    }
};

const sendTestEmail = async (req, res) => {
    try {
        const { templateId, email, subject, content } = req.body;
        const { sendTemplateEmail } = require('../utils/emailService');

        let finalSubject = subject;
        let finalContent = content;

        if (templateId) {
            const template = await prisma.emailTemplate.findUnique({
                where: { id: templateId }
            });
            if (template) {
                finalSubject = template.subject;
                finalContent = template.content;
            }
        }

        // Replace basic placeholders for test
        finalSubject = (finalSubject || 'Test Email').replace(/{{name}}/g, 'Valued Client');
        finalContent = (finalContent || '').replace(/{{name}}/g, 'Valued Client');

        const success = await sendTemplateEmail(email, finalSubject, finalContent);

        if (success) {
            res.status(200).json({ success: true, message: 'Test email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send test email' });
        }
    } catch (error) {
        console.error('Send test email error:', error);
        res.status(500).json({ success: false, message: 'Server error sending test email' });
    }
};

const getEmailSettings = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const module = await prisma.tenantModule.findFirst({
            where: { tenantId, module: { slug: 'marketing_hub' } }
        });

        const settings = module?.settings || {};
        const emailConfig = settings.emailConfig || {
            emailSkinColor: '#4f46e5',
            showFooter: true,
            footerText: '',
            enableAiRecommendations: true
        };

        res.status(200).json({ success: true, data: emailConfig });
    } catch (error) {
        console.error('Get email settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const saveEmailSettings = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const config = req.body;

        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const module = await prisma.tenantModule.findFirst({
            where: { tenantId, module: { slug: 'marketing_hub' } }
        });

        if (!module) return res.status(404).json({ success: false, message: 'Marketing module not active' });

        const updatedSettings = {
            ...(module.settings || {}),
            emailConfig: config
        };

        await prisma.tenantModule.update({
            where: {
                tenantId_moduleId: {
                    tenantId: module.tenantId,
                    moduleId: module.moduleId
                }
            },
            data: { settings: updatedSettings }
        });

        res.status(200).json({ success: true, message: 'Email configuration saved successfully' });
    } catch (error) {
        console.error('Save email settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getAllTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    sendTestEmail,
    getEmailSettings,
    saveEmailSettings
};

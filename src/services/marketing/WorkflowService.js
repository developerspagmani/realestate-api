const { prisma } = require('../../config/database');

class WorkflowService {
    /**
     * Enroll a lead into a workflow
     */
    static async enrollLead(workflowId, leadId) {
        try {
            // Check if already enrolled
            const existing = await prisma.workflowEnrollment.findUnique({
                where: { workflowId_leadId: { workflowId, leadId } }
            });

            if (existing) return existing;

            const workflow = await prisma.marketingWorkflow.findUnique({ where: { id: workflowId } });
            if (!workflow || workflow.status !== 1) return null;

            // Find start node
            const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
            const startStep = steps.find(s => s.type === 'START') || steps[0];

            return await prisma.workflowEnrollment.create({
                data: {
                    workflowId,
                    leadId,
                    currentStep: startStep?.id,
                    status: 1, // Active
                    nextActionAt: new Date() // Process immediately
                }
            });
        } catch (error) {
            console.error('Enroll lead error:', error);
            return null;
        }
    }

    /**
     * Process active enrollments (Main Engine)
     * This could be called by a cron job or manually for testing
     */
    static async processWorkflows() {
        const activeEnrollments = await prisma.workflowEnrollment.findMany({
            where: {
                status: 1,
                nextActionAt: { lte: new Date() }
            },
            include: {
                workflow: true,
                lead: true
            }
        });

        for (const enrollment of activeEnrollments) {
            await this.processStep(enrollment);
        }
    }

    static async processStep(enrollment) {
        const steps = typeof enrollment.workflow.steps === 'string'
            ? JSON.parse(enrollment.workflow.steps)
            : enrollment.workflow.steps;

        const currentStep = steps.find(s => s.id === enrollment.currentStep);
        if (!currentStep) {
            await prisma.workflowEnrollment.update({
                where: { id: enrollment.id },
                data: { status: 2 } // Completed
            });
            return;
        }

        // Execute action based on step type
        let actionResult = { success: true };
        let nextStepId = currentStep.nextStepId;
        let delaySeconds = 0;

        try {
            switch (currentStep.type) {
                case 'EMAIL':
                    // Logic to send email template
                    if (currentStep.templateId) {
                        const template = await prisma.emailTemplate.findUnique({
                            where: { id: currentStep.templateId }
                        });

                        if (template && enrollment.lead.email) {
                            const { sendTemplateEmail } = require('../../utils/emailService');
                            const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';

                            // 1. Personalization
                            let customizedContent = template.content;
                            let subject = template.subject || 'Special Update';

                            if (enrollment.lead.name) {
                                customizedContent = customizedContent.replace(/{{name}}/gi, enrollment.lead.name);
                                subject = subject.replace(/{{name}}/gi, enrollment.lead.name);
                            } else {
                                customizedContent = customizedContent.replace(/{{name}}/gi, 'Valued Client');
                            }

                            // 2. Click Tracking (Wrap Links)
                            customizedContent = customizedContent.replace(/href="([^"]*)"/gi, (match, url) => {
                                if (url.startsWith('mailto:') || url.startsWith('#') || !url.startsWith('http')) return match;
                                const trackerUrl = `${baseUrl}/api/public/track/click?w=${enrollment.workflowId}&l=${enrollment.leadId}&u=${encodeURIComponent(url)}`;
                                return `href="${trackerUrl}"`;
                            });

                            // 3. Open Tracking (Inject Pixel)
                            const pixelUrl = `${baseUrl}/api/public/track/open?w=${enrollment.workflowId}&l=${enrollment.leadId}`;
                            customizedContent += `<img src="${pixelUrl}" width="1" height="1" style="display:none !important;" />`;

                            await sendTemplateEmail(enrollment.lead.email, subject, customizedContent);
                        }
                    }
                    console.log(`Sending tracked email ${currentStep.templateId} to ${enrollment.lead.email}`);
                    break;
                case 'DELAY':
                    delaySeconds = currentStep.delaySeconds || 3600;
                    break;
                case 'TAG':
                    // Add/Remove lead tag
                    if (currentStep.tag) {
                        const currentTags = enrollment.lead.tags ? enrollment.lead.tags.split(',') : [];
                        let newTags = [...currentTags];

                        if (currentStep.action === 'add' && !newTags.includes(currentStep.tag)) {
                            newTags.push(currentStep.tag);
                        } else if (currentStep.action === 'remove') {
                            newTags = newTags.filter(t => t !== currentStep.tag);
                        }

                        await prisma.lead.update({
                            where: { id: enrollment.leadId },
                            data: { tags: newTags.join(',') }
                        });
                    }
                    break;
                case 'ASSIGN':
                    // Re-assign lead to specific agent or auto-assign
                    if (currentStep.agentId) {
                        let targetAgentId = currentStep.agentId;

                        if (targetAgentId === 'auto') {
                            const { assignLeadRoundRobin } = require('../../controllers/agentController');
                            await assignLeadRoundRobin(enrollment.workflow.tenantId, enrollment.leadId);
                        } else {
                            // Deactivate existing
                            await prisma.agentLead.updateMany({
                                where: { leadId: enrollment.leadId, status: 1 },
                                data: { status: 2 }
                            });
                            // Assign new
                            await prisma.agentLead.create({
                                data: {
                                    agentId: targetAgentId,
                                    leadId: enrollment.leadId,
                                    isPrimary: true,
                                    status: 1
                                }
                            });
                        }
                    }
                    break;
            }

            // Log the action
            await prisma.workflowLog.create({
                data: {
                    enrollmentId: enrollment.id,
                    stepId: currentStep.id,
                    actionType: currentStep.type,
                    status: 'SUCCESS',
                    result: actionResult
                }
            });

            // Update enrollment for next step
            await prisma.workflowEnrollment.update({
                where: { id: enrollment.id },
                data: {
                    currentStep: nextStepId || null,
                    status: nextStepId ? 1 : 2,
                    nextActionAt: nextStepId ? new Date(Date.now() + (delaySeconds * 1000)) : null
                }
            });

        } catch (error) {
            console.error(`Error processing step ${currentStep.id}:`, error);
        }
    }
}

module.exports = WorkflowService;

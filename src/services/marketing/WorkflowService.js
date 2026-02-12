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

    static findStep(steps, id) {
        if (!steps || !Array.isArray(steps)) return null;
        for (const step of steps) {
            if (step.id === id) return step;
            if (step.yesSteps) {
                const found = this.findStep(step.yesSteps, id);
                if (found) return found;
            }
            if (step.noSteps) {
                const found = this.findStep(step.noSteps, id);
                if (found) return found;
            }
        }
        return null;
    }

    static findNextStepId(steps, currentId) {
        if (!steps || !Array.isArray(steps)) return undefined;
        for (let i = 0; i < steps.length; i++) {
            if (steps[i].id === currentId) {
                return steps[i + 1]?.id || null;
            }
            if (steps[i].yesSteps) {
                const found = this.findNextStepId(steps[i].yesSteps, currentId);
                if (found !== undefined) return found;
            }
            if (steps[i].noSteps) {
                const found = this.findNextStepId(steps[i].noSteps, currentId);
                if (found !== undefined) return found;
            }
        }
        return undefined;
    }

    static async processStep(enrollment) {
        const steps = typeof enrollment.workflow.steps === 'string'
            ? JSON.parse(enrollment.workflow.steps)
            : enrollment.workflow.steps;

        const currentStep = this.findStep(steps, enrollment.currentStep);
        if (!currentStep) {
            await prisma.workflowEnrollment.update({
                where: { id: enrollment.id },
                data: { status: 2 } // Completed
            });
            return;
        }

        // Execute action based on step type
        let actionResult = { success: true };
        let nextStepId = this.findNextStepId(steps, currentStep.id);
        if (nextStepId === undefined) nextStepId = null;

        let delaySeconds = 0;

        try {
            switch (currentStep.type) {
                case 'EMAIL':
                    if (currentStep.templateId) {
                        const template = await prisma.emailTemplate.findUnique({
                            where: { id: currentStep.templateId }
                        });

                        if (template && enrollment.lead.email) {
                            const { sendTemplateEmail } = require('../../utils/emailService');
                            const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';

                            let customizedContent = template.content;
                            let subject = template.subject || 'Special Update';

                            if (enrollment.lead.name) {
                                customizedContent = customizedContent.replace(/{{name}}/gi, enrollment.lead.name);
                                subject = subject.replace(/{{name}}/gi, enrollment.lead.name);
                            } else {
                                customizedContent = customizedContent.replace(/{{name}}/gi, 'Valued Client');
                            }

                            // Tracking links
                            customizedContent = customizedContent.replace(/href="([^"]*)"/gi, (match, url) => {
                                if (url.startsWith('mailto:') || url.startsWith('#') || !url.startsWith('http')) return match;
                                const trackerUrl = `${baseUrl}/api/public/track/click?w=${enrollment.workflowId}&l=${enrollment.leadId}&u=${encodeURIComponent(url)}`;
                                return `href="${trackerUrl}"`;
                            });

                            const pixelUrl = `${baseUrl}/api/public/track/open?w=${enrollment.workflowId}&l=${enrollment.leadId}`;
                            customizedContent += `<img src="${pixelUrl}" width="1" height="1" style="display:none !important;" />`;

                            await sendTemplateEmail(enrollment.lead.email, subject, customizedContent);
                        }
                    }
                    console.log(`Sending tracked email ${currentStep.templateId} to ${enrollment.lead.email}`);
                    break;

                case 'DELAY':
                    const duration = currentStep.duration || 1;
                    const unit = currentStep.unit || 'hours';
                    const multiplier = { 'minutes': 60, 'hours': 3600, 'days': 86400 };
                    delaySeconds = duration * (multiplier[unit] || 3600);
                    break;

                case 'CONDITION':
                    const { field, operator, value: targetValue } = currentStep;
                    const leadValue = enrollment.lead[field];
                    let conditionMet = false;

                    const valStr = String(leadValue || '').toLowerCase();
                    const targetStr = String(targetValue || '').toLowerCase();

                    switch (operator) {
                        case 'equals': conditionMet = valStr === targetStr; break;
                        case 'greater_than': conditionMet = Number(leadValue) > Number(targetValue); break;
                        case 'contains': conditionMet = valStr.includes(targetStr); break;
                        case 'not_empty': conditionMet = !!leadValue; break;
                    }

                    const branch = conditionMet ? currentStep.yesSteps : currentStep.noSteps;
                    nextStepId = branch && branch.length > 0 ? branch[0].id : nextStepId;
                    // Note: if branch is empty, it continues with the sibling nextStepId (if any)
                    break;

                case 'TAG':
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
                    if (currentStep.agentId) {
                        if (currentStep.agentId === 'auto') {
                            const { assignLeadRoundRobin } = require('../../controllers/agentController');
                            await assignLeadRoundRobin(enrollment.workflow.tenantId, enrollment.leadId);
                        } else {
                            await prisma.agentLead.updateMany({
                                where: { leadId: enrollment.leadId, status: 1 },
                                data: { status: 2 }
                            });
                            await prisma.agentLead.create({
                                data: {
                                    agentId: currentStep.agentId,
                                    leadId: enrollment.leadId,
                                    isPrimary: true,
                                    status: 1
                                }
                            });
                        }
                    }
                    break;
            }

            // Log action
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
                    currentStep: nextStepId,
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

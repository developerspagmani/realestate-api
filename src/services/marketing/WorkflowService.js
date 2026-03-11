const { prisma } = require('../../config/database');
const { sendTemplateEmail } = require('../../utils/emailService');

class WorkflowService {
    /**
     * Enroll a lead into a workflow
     */
    static async enrollLead(workflowId, leadId) {
        console.log(`[WorkflowService] Enrolling lead ${leadId} into workflow ${workflowId}`);
        try {
            // Check if already enrolled
            const existing = await prisma.workflowEnrollment.findUnique({
                where: { workflowId_leadId: { workflowId, leadId } }
            });

            if (existing) {
                console.log(`[WorkflowService] Lead ${leadId} already enrolled in workflow ${workflowId}`);
                return existing;
            }

            const workflow = await prisma.marketingWorkflow.findUnique({ where: { id: workflowId } });
            if (!workflow) return null;

            const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
            const firstStepId = steps && steps.length > 0 ? steps[0].id : null;

            const enrollment = await prisma.workflowEnrollment.create({
                data: {
                    workflowId,
                    leadId,
                    currentStep: firstStepId,
                    status: 1,
                    nextActionAt: new Date()
                }
            });

            return enrollment;
        } catch (error) {
            console.error('Enroll lead error:', error);
            throw error;
        }
    }

    /**
     * Trigger workflows for a lead based on an event
     */
    static async triggerWorkflows(tenantId, leadId, triggerType, metadata = {}) {
        console.log(`[WorkflowService] Triggering ${triggerType} for lead ${leadId} in tenant ${tenantId}`);
        try {
            const workflows = await prisma.marketingWorkflow.findMany({
                where: { tenantId, status: 1 }
            });

            console.log(`[WorkflowService] Found ${workflows.length} active workflows for tenant`);

            for (const wf of workflows) {
                const trigger = typeof wf.trigger === 'string' ? JSON.parse(wf.trigger) : wf.trigger;
                if (!trigger) continue;

                console.log(`[WorkflowService] Checking workflow "${wf.name}" with trigger:`, trigger);

                // Normalization mapping
                const triggerMapping = {
                    'New Lead': 'LEAD_CREATED',
                    'LEAD_CREATED': 'LEAD_CREATED',
                    'Status Changed': 'STATUS_CHANGED',
                    'STATUS_CHANGED': 'STATUS_CHANGED',
                    'Match Found': 'MATCH_FOUND',
                    'MATCH_FOUND': 'MATCH_FOUND',
                    'Property Added': 'PROPERTY_ADDED',
                    'PROPERTY_ADDED': 'PROPERTY_ADDED',
                    'Form Submitted': 'FORM_SUBMITTED',
                    'FORM_SUBMITTED': 'FORM_SUBMITTED',
                    'Tag Added': 'TAG_ADDED',
                    'TAG_ADDED': 'TAG_ADDED'
                };

                const workflowTriggerType = triggerMapping[trigger.type] || trigger.type;
                const incomingTriggerType = triggerMapping[triggerType] || triggerType;

                if (workflowTriggerType !== incomingTriggerType) continue;

                // Additional logic for specific triggers
                if (incomingTriggerType === 'FORM_SUBMITTED' && trigger.formId && trigger.formId !== metadata.formId) {
                    console.log(`[WorkflowService] Form ID mismatch: ${trigger.formId} vs ${metadata.formId}`);
                    continue;
                }
                if (incomingTriggerType === 'STATUS_CHANGED' && trigger.status && parseInt(trigger.status) !== parseInt(metadata.newStatus)) {
                    console.log(`[WorkflowService] Status mismatch: ${trigger.status} vs ${metadata.newStatus}`);
                    continue;
                }
                if (incomingTriggerType === 'TAG_ADDED' && trigger.tag && trigger.tag !== metadata.tag) {
                    console.log(`[WorkflowService] Tag mismatch: ${trigger.tag} vs ${metadata.tag}`);
                    continue;
                }

                console.log(`[WorkflowService] Enrolling lead ${leadId} into workflow "${wf.name}"`);
                await this.enrollLead(wf.id, leadId);
            }
        } catch (error) {
            console.error(`Trigger workflows error for ${triggerType}:`, error);
        }
    }

    /**
     * Process active enrollments (Main Engine)
     */
    static async processWorkflows() {
        console.log(`[WorkflowService] Checking for active workflow enrollments at ${new Date().toISOString()}...`);
        try {
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

            if (activeEnrollments.length > 0) {
                console.log(`[WorkflowService] Found ${activeEnrollments.length} enrollments to process.`);
                for (const enrollment of activeEnrollments) {
                    try {
                        await this.processStep(enrollment);
                    } catch (stepError) {
                        console.error(`[WorkflowService] Error processing enrollment ${enrollment.id}:`, stepError);
                    }
                }
            }
        } catch (error) {
            console.error('[WorkflowService] Process workflows error:', error);
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
            console.log(`[WorkflowService] Step ${enrollment.currentStep} not found for enrollment ${enrollment.id}. Completing workflow.`);
            await prisma.workflowEnrollment.update({
                where: { id: enrollment.id },
                data: { status: 2 } // Completed
            });
            return;
        }

        console.log(`[WorkflowService] Processing ${currentStep.type} step for lead ${enrollment.lead.email || enrollment.leadId}`);

        let nextStepId = this.findNextStepId(steps, currentStep.id);
        if (nextStepId === undefined) nextStepId = null;

        let delaySeconds = 0;
        let actionResult = { success: true, message: '' };

        try {
            switch (currentStep.type) {
                case 'EMAIL':
                    if (currentStep.templateId && enrollment.lead.email) {
                        const template = await prisma.emailTemplate.findUnique({
                            where: { id: currentStep.templateId }
                        });

                        if (template) {
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
                            actionResult.message = `Sent email: ${template.name}`;
                        } else {
                            actionResult.success = false;
                            actionResult.message = `Template ${currentStep.templateId} not found.`;
                        }
                    } else {
                        actionResult.success = false;
                        actionResult.message = !currentStep.templateId ? "No template ID provided." : "Lead has no email address.";
                    }
                    break;

                case 'DELAY': {
                    const duration = currentStep.duration || 1;
                    const unit = currentStep.unit || 'hours';
                    const multiplier = { 'minutes': 60, 'hours': 3600, 'days': 86400 };
                    delaySeconds = duration * (multiplier[unit] || 3600);
                    actionResult.message = `Delayed for ${duration} ${unit}`;
                    break;
                }

                case 'CONDITION': {
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
                    actionResult.message = `Condition ${field} ${operator} ${targetValue} evaluated to ${conditionMet}`;
                    break;
                }

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
                        actionResult.message = `${currentStep.action === 'add' ? 'Added' : 'Removed'} tag: ${currentStep.tag}`;
                    }
                    break;

                case 'ASSIGN':
                    if (currentStep.agentId) {
                        try {
                            // Using a direct assignment instead of circular dependency
                            if (currentStep.agentId === 'auto') {
                                // Round Robin logic is usually in agentService, we can replicate or import carefully
                                // For now, let's assume we can import it
                                const { assignLeadRoundRobin } = require('../../controllers/agentController');
                                await assignLeadRoundRobin(enrollment.workflow.tenantId, enrollment.leadId);
                            } else {
                                await prisma.agentLead.updateMany({
                                    where: { leadId: enrollment.leadId, status: 1 },
                                    data: { status: 2 } // Mark old as inactive
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
                            actionResult.message = `Assigned lead to agent: ${currentStep.agentId}`;
                        } catch (err) {
                            actionResult.success = false;
                            actionResult.message = `Assignment failed: ${err.message}`;
                        }
                    }
                    break;
            }

            // Record Log
            await prisma.workflowLog.create({
                data: {
                    enrollmentId: enrollment.id,
                    stepId: currentStep.id,
                    actionType: currentStep.type,
                    status: actionResult.success ? 'SUCCESS' : 'FAILED',
                    result: actionResult,
                    tenantId: enrollment.workflow.tenantId
                }
            });

            // Update Enrollment
            await prisma.workflowEnrollment.update({
                where: { id: enrollment.id },
                data: {
                    currentStep: nextStepId,
                    status: nextStepId ? 1 : 2,
                    nextActionAt: nextStepId ? new Date(Date.now() + (delaySeconds * 1000)) : null
                }
            });

        } catch (error) {
            console.error(`[WorkflowService] Error processing step ${currentStep.id}:`, error);
            try {
                await prisma.workflowLog.create({
                    data: {
                        enrollmentId: enrollment.id,
                        stepId: currentStep.id,
                        actionType: currentStep.type,
                        status: 'ERROR',
                        result: { error: error.message },
                        tenantId: enrollment.workflow.tenantId
                    }
                });
            } catch (logErr) {
                console.error('[WorkflowService] Failed to record error log:', logErr);
            }
        }
    }

    /**
     * Test a workflow simulation (DRY RUN)
     */
    static async testWorkflow(workflowData, testLeadData) {
        const logs = [];
        const steps = typeof workflowData.steps === 'string' ? JSON.parse(workflowData.steps) : workflowData.steps;

        let currentStepId = steps && steps.length > 0 ? steps[0].id : null;
        let iterations = 0;
        const maxIterations = 50; // Safety cap

        logs.push({
            type: 'INFO',
            message: `Starting test simulation for workflow: ${workflowData.name}`,
            occurredAt: new Date()
        });

        while (currentStepId && iterations < maxIterations) {
            iterations++;
            const currentStep = this.findStep(steps, currentStepId);

            if (!currentStep) {
                logs.push({ type: 'INFO', message: 'No more steps found. Workflow complete.', occurredAt: new Date() });
                break;
            }

            let stepLog = {
                stepId: currentStep.id,
                type: currentStep.type,
                status: 'EXECUTED',
                occurredAt: new Date()
            };

            let nextStepId = this.findNextStepId(steps, currentStep.id);
            if (nextStepId === undefined) nextStepId = null;

            try {
                switch (currentStep.type) {
                    case 'EMAIL':
                        if (currentStep.templateId && testLeadData.email) {
                            const template = await prisma.emailTemplate.findUnique({
                                where: { id: currentStep.templateId }
                            });

                            if (template) {
                                let customizedContent = template.content;
                                let subject = `[TEST] ${template.subject || 'Special Update'}`;

                                // Basic personalization for test
                                const name = testLeadData.name || 'Test User';
                                customizedContent = customizedContent.replace(/{{name}}/gi, name);
                                subject = subject.replace(/{{name}}/gi, name);

                                await sendTemplateEmail(testLeadData.email, subject, customizedContent);
                                stepLog.message = `[TEST EMAIL SENT] Sent template "${template.name}" to ${testLeadData.email}`;
                            } else {
                                stepLog.message = `[ERROR] Email template ${currentStep.templateId} not found`;
                                stepLog.status = 'ERROR';
                            }
                        } else {
                            stepLog.message = `[SIMULATED] Would send email template ${currentStep.templateId} to ${testLeadData.email || 'N/A'}`;
                        }
                        break;

                    case 'DELAY':
                        stepLog.message = `[SIMULATED] Wait for ${currentStep.duration} ${currentStep.unit}`;
                        break;

                    case 'CONDITION': {
                        const { field, operator, value: targetValue } = currentStep;
                        const leadValue = testLeadData[field];
                        let conditionMet = false;

                        const valStr = String(leadValue || '').toLowerCase();
                        const targetStr = String(targetValue || '').toLowerCase();

                        switch (operator) {
                            case 'equals': conditionMet = valStr === targetStr; break;
                            case 'greater_than': conditionMet = Number(leadValue) > Number(targetValue); break;
                            case 'contains': conditionMet = valStr.includes(targetStr); break;
                            case 'not_empty': conditionMet = !!leadValue; break;
                        }

                        stepLog.message = `Condition check: ${field} (${leadValue}) ${operator} ${targetValue} => ${conditionMet ? 'YES' : 'NO'}`;
                        const branch = conditionMet ? currentStep.yesSteps : currentStep.noSteps;
                        nextStepId = branch && branch.length > 0 ? branch[0].id : nextStepId;
                        break;
                    }

                    case 'TAG':
                        stepLog.message = `[SIMULATED] ${currentStep.action === 'add' ? 'Add' : 'Remove'} Tag: ${currentStep.tag}`;
                        break;

                    case 'ASSIGN':
                        stepLog.message = `[SIMULATED] Assign to agent: ${currentStep.agentId}`;
                        break;

                    default:
                        stepLog.message = `Unknown step type: ${currentStep.type}`;
                }

                logs.push(stepLog);
                currentStepId = nextStepId;

            } catch (error) {
                logs.push({
                    stepId: currentStep.id,
                    type: currentStep.type,
                    status: 'ERROR',
                    message: `Error: ${error.message}`,
                    occurredAt: new Date()
                });
                break;
            }
        }

        if (iterations >= maxIterations) {
            logs.push({ type: 'WARNING', message: 'Maximum iterations reached. Possible infinite loop in workflow logic.', occurredAt: new Date() });
        }

        return { success: true, logs };
    }
}

module.exports = WorkflowService;

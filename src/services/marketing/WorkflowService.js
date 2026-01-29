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
                    console.log(`Sending email ${currentStep.templateId} to ${enrollment.lead.email}`);
                    // In real implementation, call emailService here
                    break;
                case 'DELAY':
                    delaySeconds = currentStep.delaySeconds || 3600;
                    break;
                case 'TAG':
                    // Add lead to a group or update status
                    break;
                default:
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

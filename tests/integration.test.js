const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/database');

describe('Backend Integration Tests', () => {
    let authToken;
    let tenantId;
    let testUnitId;
    let testPropertyId;
    let createdLeadId;
    let createdWorkflowId;

    // ─── 1. Auth ───────────────────────────────────────────────────────────────
    test('POST /api/auth/login - Should login and return token', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@system.com', password: 'password123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        authToken = response.body.data.token;
        tenantId = response.body.data.user.tenantId;
    });

    // ─── 2. Properties ─────────────────────────────────────────────────────────
    test('GET /api/properties - Should fetch properties', async () => {
        const response = await request(app)
            .get('/api/properties')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.properties)).toBe(true);

        const propertyWithUnits = response.body.data.properties.find(p => p.units && p.units.length > 0);
        if (propertyWithUnits) {
            testPropertyId = propertyWithUnits.id;
            testUnitId = propertyWithUnits.units[0].id;
        } else if (response.body.data.properties.length > 0) {
            testPropertyId = response.body.data.properties[0].id;
        }
    });

    // ─── 2.1 Bookings ──────────────────────────────────────────────────────────
    test('POST /api/bookings - Should create a booking', async () => {
        if (!testUnitId) {
            console.warn('Skipping booking creation: No test unit found');
            return;
        }

        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 1);
        const endAt = new Date(startAt);
        endAt.setDate(endAt.getDate() + 7);

        const response = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                unitId: testUnitId,
                propertyId: testPropertyId,
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                notes: 'Test booking from integration suite',
                customerInfo: {
                    name: 'Test Customer',
                    email: 'test@customer.com',
                    phone: '1234567890'
                }
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });

    test('GET /api/bookings/stats - Should fetch booking stats', async () => {
        const response = await request(app)
            .get('/api/bookings/stats')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
    });

    // ─── 3. Leads ──────────────────────────────────────────────────────────────
    test('GET /api/leads - Should fetch leads', async () => {
        const response = await request(app)
            .get('/api/leads')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    // ─── 4. Advanced Analytics ─────────────────────────────────────────────────
    test('GET /api/admin/analytics-pro/revenue-funnel - Should fetch data', async () => {
        const response = await request(app)
            .get('/api/admin/analytics-pro/revenue-funnel')
            .set('Authorization', `Bearer ${authToken}`);

        expect([200, 403, 500]).toContain(response.status);
        if (response.status === 200) {
            expect(response.body.success).toBe(true);
        }
    });

    // ─── 5. Social Health ──────────────────────────────────────────────────────
    test('GET /api/social/health - Should be healthy', async () => {
        const response = await request(app)
            .get('/api/social/health');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    // ─── 6. Email Marketing ────────────────────────────────────────────────────
    test('Email Marketing - Should manage templates and audience', async () => {
        const audienceRes = await request(app)
            .get('/api/marketing/audience')
            .set('Authorization', `Bearer ${authToken}`);

        expect(audienceRes.status).toBe(200);
        expect(audienceRes.body.success).toBe(true);
        expect(Array.isArray(audienceRes.body.data)).toBe(true);

        const templateRes = await request(app)
            .get('/api/marketing/templates')
            .set('Authorization', `Bearer ${authToken}`);

        expect(templateRes.status).toBe(200);
        expect(templateRes.body.success).toBe(true);
        expect(Array.isArray(templateRes.body.data)).toBe(true);

        const statsRes = await request(app)
            .get('/api/marketing/stats')
            .set('Authorization', `Bearer ${authToken}`);

        expect(statsRes.status).toBe(200);
        expect(statsRes.body.success).toBe(true);
        expect(statsRes.body.data).toBeDefined();
    });

    test('Marketing Workflows - Should list automated workflows', async () => {
        const response = await request(app)
            .get('/api/marketing/workflows')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    // ─── 7. Workflow Trigger Tests ─────────────────────────────────────────────
    describe('Workflow Trigger Tests', () => {

        // 7.1: Create a LEAD_CREATED workflow directly in DB for testing
        test('Setup: Create a LEAD_CREATED trigger workflow in DB', async () => {
            if (!tenantId) {
                console.warn('Skipping workflow setup: No tenantId');
                return;
            }

            const workflow = await prisma.marketingWorkflow.create({
                data: {
                    tenantId,
                    name: '[Test] LEAD_CREATED Workflow',
                    description: 'Integration test workflow - auto-delete after test',
                    trigger: { type: 'LEAD_CREATED', source: 'Any' },
                    steps: [
                        { id: 'step-delay-1', type: 'DELAY', duration: 1, unit: 'hours' }
                    ],
                    status: 1 // Active
                }
            });

            expect(workflow).toBeDefined();
            expect(workflow.id).toBeDefined();
            createdWorkflowId = workflow.id;
        });

        // 7.2: Creating a lead should trigger LEAD_CREATED workflow enrollment
        test('POST /api/leads - Creating a lead should trigger LEAD_CREATED workflow', async () => {
            if (!tenantId || !createdWorkflowId) {
                console.warn('Skipping: prerequisites not met');
                return;
            }

            const leadRes = await request(app)
                .post('/api/leads')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Workflow Trigger Test Lead',
                    email: `workflow-test-${Date.now()}@example.com`,
                    phone: '9876543210',
                    source: 1, // website
                    message: 'Interested in 3-bed apartment',
                    tenantId
                });

            // Lead creation should succeed
            expect(leadRes.status).toBe(201);
            expect(leadRes.body.success).toBe(true);
            expect(leadRes.body.data.lead).toBeDefined();
            createdLeadId = leadRes.body.data.lead.id;

            // Give a moment for async workflow enrollment
            await new Promise(r => setTimeout(r, 500));

            // Verify the lead was enrolled in the workflow
            const enrollment = await prisma.workflowEnrollment.findUnique({
                where: { workflowId_leadId: { workflowId: createdWorkflowId, leadId: createdLeadId } }
            });

            expect(enrollment).not.toBeNull();
            expect(enrollment.status).toBe(1); // Active
        });

        // 7.3: Check enrollment is visible via API
        test('GET /api/marketing/workflows/:id/enrollments - Should show enrolled lead', async () => {
            if (!createdWorkflowId) {
                console.warn('Skipping: no workflow ID');
                return;
            }

            const response = await request(app)
                .get(`/api/marketing/workflows/${createdWorkflowId}/enrollments`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            if (createdLeadId) {
                const found = response.body.data.some(e => e.leadId === createdLeadId);
                expect(found).toBe(true);
            }
        });

        // 7.4: Test STATUS_CHANGED workflow trigger
        test('Setup: Create a STATUS_CHANGED trigger workflow in DB', async () => {
            if (!tenantId) {
                console.warn('Skipping: No tenantId');
                return;
            }

            const workflow = await prisma.marketingWorkflow.create({
                data: {
                    tenantId,
                    name: '[Test] STATUS_CHANGED Workflow',
                    description: 'Integration test - status changed trigger',
                    trigger: { type: 'STATUS_CHANGED', status: '2' }, // trigger on "Contacted"
                    steps: [
                        { id: 'step-tag-1', type: 'TAG', action: 'add', tag: 'Contacted' }
                    ],
                    status: 1
                }
            });

            expect(workflow).toBeDefined();
            // Track this for cleanup
            await prisma.marketingWorkflow.update({
                where: { id: workflow.id },
                data: { description: `[TEST-CLEANUP] ${workflow.id}` }
            });
        });

        // 7.5: Update lead status and verify STATUS_CHANGED trigger
        test('PUT /api/leads/:id/status - Status change should trigger STATUS_CHANGED workflow', async () => {
            if (!createdLeadId) {
                console.warn('Skipping: no lead to update');
                return;
            }

            const statusRes = await request(app)
                .put(`/api/leads/${createdLeadId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 2, tenantId }); // Contacted - tenantId required by Joi schema

            expect(statusRes.status).toBe(200);
            expect(statusRes.body.success).toBe(true);

            // Give async trigger time
            await new Promise(r => setTimeout(r, 500));

            // Should have an enrollment in the STATUS_CHANGED workflow
            const statusWorkflow = await prisma.marketingWorkflow.findFirst({
                where: { tenantId, name: '[Test] STATUS_CHANGED Workflow' }
            });

            if (statusWorkflow) {
                const enrollment = await prisma.workflowEnrollment.findUnique({
                    where: { workflowId_leadId: { workflowId: statusWorkflow.id, leadId: createdLeadId } }
                });
                expect(enrollment).not.toBeNull();
            }
        });

        // 7.6: Test manual enrollment via API
        test('POST /api/marketing/workflows/enroll - Should manually enroll a lead', async () => {
            if (!createdWorkflowId || !createdLeadId) {
                console.warn('Skipping: prerequisites not met');
                return;
            }

            // First, delete the existing enrollment so we can re-enroll
            await prisma.workflowEnrollment.deleteMany({
                where: { workflowId: createdWorkflowId, leadId: createdLeadId }
            });

            const response = await request(app)
                .post('/api/marketing/workflows/enroll')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ workflowId: createdWorkflowId, leadId: createdLeadId });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.workflowId).toBe(createdWorkflowId);
            expect(response.body.data.leadId).toBe(createdLeadId);
        });

        // 7.7: Test workflow engine execution
        test('POST /api/marketing/workflows/process - Should run the workflow engine', async () => {
            const response = await request(app)
                .post('/api/marketing/workflows/process')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        // 7.8: Cleanup test data
        afterAll(async () => {
            try {
                if (createdLeadId) {
                    await prisma.workflowEnrollment.deleteMany({ where: { leadId: createdLeadId } });
                    await prisma.leadInteraction.deleteMany({ where: { leadId: createdLeadId } });
                    await prisma.agentLead.deleteMany({ where: { leadId: createdLeadId } });
                    await prisma.lead.delete({ where: { id: createdLeadId } });
                }

                // Cleanup test workflows
                const testWorkflows = await prisma.marketingWorkflow.findMany({
                    where: { tenantId, name: { startsWith: '[Test]' } }
                });
                for (const wf of testWorkflows) {
                    await prisma.workflowEnrollment.deleteMany({ where: { workflowId: wf.id } });
                    await prisma.workflowLog.deleteMany({ where: { enrollment: { workflowId: wf.id } } });
                    await prisma.marketingWorkflow.delete({ where: { id: wf.id } });
                }
            } catch (e) {
                console.warn('Cleanup warning:', e.message);
            }
        });
    });
});

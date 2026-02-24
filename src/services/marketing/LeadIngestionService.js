const { prisma } = require('../../config/database');

/**
 * Lead Ingestion Service
 * Normalizes lead data from various external portals and sources
 */
class LeadIngestionService {
    /**
     * Ingest a lead from an external source
     * @param {object} data - Normalized lead data
     * @param {string} sourcePortal - e.g., "99ACRES", "MAGICBRICKS"
     */
    async ingestLead(data, sourcePortal) {
        try {
            const { tenantId, name, email, phone, message, propertyId, metadata = {} } = data;

            if (!tenantId) {
                throw new Error('Tenant ID is required for lead ingestion');
            }

            // Map source portal to our internal source IDs
            const sourceMap = {
                '99ACRES': 8, // Assuming 8 is 99acres (Source 7 was WhatsApp)
                'MAGICBRICKS': 9,
                'FACEBOOK': 5,
                'INSTAGRAM': 6
            };

            const sourceId = sourceMap[sourcePortal] || 1; // Default to Web/Organic if unknown

            // 1. Find or Create Lead
            let lead = await prisma.lead.findFirst({
                where: {
                    tenantId,
                    OR: [
                        { email: email || 'never-match-empty' },
                        { phone: phone || 'never-match-empty' }
                    ]
                }
            });

            if (lead) {
                // Update existing lead
                lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        name: name || lead.name,
                        status: lead.status === 4 ? 1 : lead.status, // Move back to New if it was previously Junk/Closed? (Optional logic)
                        updatedAt: new Date(),
                        notes: lead.notes ? `${lead.notes}\n---\nRefreshed via ${sourcePortal}: ${message}` : `From ${sourcePortal}: ${message}`
                    }
                });
            } else {
                // Create new lead
                lead = await prisma.lead.create({
                    data: {
                        tenantId,
                        name: name || `Lead from ${sourcePortal}`,
                        email,
                        phone,
                        message,
                        source: sourceId,
                        status: 1, // New
                        propertyId,
                        preferences: {
                            sourcePortal,
                            originalMetadata: metadata,
                            ...(propertyId ? { lastInquiryPropertyId: propertyId } : {})
                        }
                    }
                });

                // Trigger automations for NEW lead
                try {
                    const WorkflowService = require('./WorkflowService'); // Adjust path if needed
                    await WorkflowService.triggerWorkflows(tenantId, lead.id, 'LEAD_CREATED');
                } catch (e) {
                    console.warn('[LeadIngestion] Workflow trigger failed:', e.message);
                }
            }

            // 2. Register Interaction
            await prisma.leadInteraction.create({
                data: {
                    tenantId,
                    leadId: lead.id,
                    type: 'INQUIRY',
                    metadata: {
                        portal: sourcePortal,
                        message,
                        propertyId,
                        ...metadata
                    }
                }
            });

            console.log(`[LeadIngestion] Successfully ingested lead ${lead.id} from ${sourcePortal}`);
            return { success: true, leadId: lead.id };
        } catch (error) {
            console.error('[LeadIngestion] Error ingesting lead:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new LeadIngestionService();

const { prisma } = require('../../config/database');
const axios = require('axios');
const xml2js = require('xml2js');

/**
 * 99acres Portal Service
 * Handles property synchronization and lead retrieval for 99acres.com
 */
class Portal99AcresService {
    constructor() {
        this.apiUrl = 'http://leadfeed.99acres.com/public/v1/getLeads'; // Standard 99acres API
    }

    /**
     * Generate 99acres compatible XML for a property
     * @param {object} property - The internal property object
     */
    generatePropertyXml(property) {
        // This is a simplified version of the 99acres XML format
        // Usually, 99acres requires a specific header and tags for RERA, location IDs, etc.
        const builder = new xml2js.Builder();

        const xmlObj = {
            Listing: {
                Property: {
                    Title: property.title,
                    Description: property.description,
                    Address: property.addressLine1,
                    City: property.city,
                    State: property.state,
                    Price: property.price,
                    Bedrooms: property.bedrooms,
                    Bathrooms: property.bathrooms,
                    Area: property.area,
                    ListingType: property.listingType === 'Rent' ? 'R' : 'S',
                    Images: {
                        Image: property.mainImage ? [property.mainImage.url] : []
                    },
                    Metadata: {
                        Source: 'Virpanix_PortalHub',
                        InternalId: property.id
                    }
                }
            }
        };

        return builder.buildObject(xmlObj);
    }

    /**
     * Sync a property to 99acres (Simulated via XML generation or API post)
     */
    async publishListing(propertyId, tenantId) {
        try {
            const property = await prisma.property.findUnique({
                where: { id: propertyId },
                include: { mainImage: true }
            });

            if (!property) throw new Error('Property not found');

            // 1. Generate XML
            const xml = this.generatePropertyXml(property);

            // 2. Register/Update entry in portal_listings
            const portalListing = await prisma.portalListing.upsert({
                where: {
                    // We might need a unique constraint on tenantId_propertyId_portal
                    id: (await prisma.portalListing.findFirst({
                        where: { propertyId, portal: '99ACRES', tenantId }
                    }))?.id || '00000000-0000-0000-0000-000000000000'
                },
                update: {
                    status: 'PUBLISHED',
                    lastSyncAt: new Date(),
                    metadata: { lastXml: xml }
                },
                create: {
                    tenantId,
                    propertyId,
                    portal: '99ACRES',
                    status: 'PUBLISHED',
                    metadata: { lastXml: xml }
                }
            });

            // Note: In real production, you would upload this XML to 99acres FTP or POST to their API
            return { success: true, portalListing };
        } catch (error) {
            console.error('[99AcresService] Publish error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch leads from 99acres Lead Feed API
     * @param {string} username - 99acres username
     * @param {string} password - 99acres password
     */
    async pollLeads(tenantId, credentials) {
        try {
            // Simulated API call to 99acres
            /*
            const response = await axios.get(this.apiUrl, {
                params: {
                    user: credentials.username,
                    pswd: credentials.password,
                    start_date: new Date(Date.now() - 86400000).toISOString() // Last 24h
                }
            });
            */

            // Mocking a few leads for logic verification
            const mockLeads = [
                {
                    name: "Rahul Sharma",
                    email: "rahul.s@example.com",
                    phone: "+919876543210",
                    message: "Interested in the 3BHK Villa in Bangalore",
                    propertyTitle: "Modern 3BHK Villa"
                }
            ];

            const leadIngestionService = require('../marketing/LeadIngestionService');
            const results = [];

            for (const leadData of mockLeads) {
                const result = await leadIngestionService.ingestLead({
                    tenantId,
                    ...leadData,
                    metadata: { source: '99acres_api_poll' }
                }, '99ACRES');
                results.push(result);
            }

            return { success: true, processed: results.length };
        } catch (error) {
            console.error('[99AcresService] Poll error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new Portal99AcresService();

const { prisma } = require('../config/database');
const path = require('path');

const trackOpen = async (req, res) => {
    try {
        const { c: campaignId, l: leadId, w: workflowId } = req.query;

        if (leadId) {
            // Log the interaction
            await prisma.leadInteraction.create({
                data: {
                    leadId,
                    type: 'EMAIL_OPEN',
                    metadata: { campaignId, workflowId },
                    scoreWeight: 1
                }
            });

            // Update campaign stats if applicable
            if (campaignId) {
                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: { openedCount: { increment: 1 } }
                }).catch(e => console.error('Error updating campaign stats:', e));
            }

            // Update lead score
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    leadScore: { increment: 1 },
                    updatedAt: new Date()
                }
            }).catch(e => console.error('Error updating lead score:', e));
        }

        // Return a 1x1 transparent pixel
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(pixel);

    } catch (error) {
        console.error('Track open error:', error);
        // Still return the pixel even on error to avoid broken image icons in email clients
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(pixel);
    }
};

const trackClick = async (req, res) => {
    try {
        const { c: campaignId, l: leadId, w: workflowId, u: targetUrl } = req.query;

        if (leadId) {
            // Log the interaction
            await prisma.leadInteraction.create({
                data: {
                    leadId,
                    type: 'EMAIL_CLICK',
                    metadata: { campaignId, workflowId, targetUrl },
                    scoreWeight: 3
                }
            });

            // Update campaign stats if applicable
            if (campaignId) {
                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: { clickedCount: { increment: 1 } }
                }).catch(e => console.error('Error updating campaign stats:', e));
            }

            // Update lead score
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    leadScore: { increment: 3 },
                    updatedAt: new Date()
                }
            }).catch(e => console.error('Error updating lead score:', e));
        }

        // Redirect to the original URL
        res.redirect(targetUrl || '/');

    } catch (error) {
        console.error('Track click error:', error);
        res.redirect(req.query.u || '/');
    }
};

module.exports = {
    trackOpen,
    trackClick
};

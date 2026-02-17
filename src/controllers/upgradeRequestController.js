const { prisma } = require('../config/database');

const upgradeRequestController = {
    // Owner: Submit an upgrade request
    submitRequest: async (req, res) => {
        try {
            const { requestedPlanId, email, message } = req.body;
            const { id: ownerId, tenantId } = req.user;

            if (!requestedPlanId || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested plan and email are required'
                });
            }

            // Get current plan if any
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { planId: true }
            });

            const request = await prisma.planUpgradeRequest.create({
                data: {
                    tenantId,
                    ownerId,
                    currentPlanId: tenant?.planId,
                    requestedPlanId,
                    email,
                    message,
                    status: 1 // Pending
                },
                include: {
                    requestedPlan: true
                }
            });

            res.status(201).json({
                success: true,
                message: 'Upgrade request submitted successfully. Our team will contact you soon.',
                data: request
            });
        } catch (error) {
            console.error('Submit upgrade request error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error submitting upgrade request'
            });
        }
    },

    // Admin: Get all upgrade requests
    getAllRequests: async (req, res) => {
        try {
            const requests = await prisma.planUpgradeRequest.findMany({
                include: {
                    tenant: true,
                    owner: {
                        select: { name: true, email: true }
                    },
                    requestedPlan: true
                },
                orderBy: { createdAt: 'desc' }
            });

            res.status(200).json({
                success: true,
                data: requests
            });
        } catch (error) {
            console.error('Get upgrade requests error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching upgrade requests'
            });
        }
    },

    // Admin: Update request status
    updateRequestStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body; // 1: Pending, 2: Approved, 3: Rejected

            const request = await prisma.planUpgradeRequest.update({
                where: { id },
                data: { status },
                include: {
                    tenant: true,
                    requestedPlan: true
                }
            });

            // If approved, we might want to automatically update the tenant's plan?
            // Usually, this would involve billing, so for now we'll just update status.
            // If the user wants auto-upgrade:
            /*
            if (status === 2) {
                await prisma.tenant.update({
                    where: { id: request.tenantId },
                    data: { planId: request.requestedPlanId }
                });
            }
            */

            res.status(200).json({
                success: true,
                message: `Request ${status === 2 ? 'approved' : status === 3 ? 'rejected' : 'updated'}`,
                data: request
            });
        } catch (error) {
            console.error('Update upgrade request status error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error updating request status'
            });
        }
    }
};

module.exports = upgradeRequestController;

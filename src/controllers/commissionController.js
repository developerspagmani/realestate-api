const { prisma } = require('../config/database');

// Calculate Commission
// Triggered when Booking is confirmed/completed
const calculateCommission = async (bookingId) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                user: {
                    include: {
                        leads: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!booking) return;

        let agentId = booking.agentId; // prioritize direct association

        if (!agentId) {
            // Method 1: Check if booking user has an explicit lead relation with agent
            const recentLead = booking.user?.leads?.[0];
            if (recentLead && recentLead.agentId) {
                agentId = recentLead.agentId;
            }

            // Method 2: Fallback to searching by email if user.leads is empty 
            // (Useful if the lead was created before the user registered)
            if (!agentId && booking.user?.email) {
                const leadByEmail = await prisma.lead.findFirst({
                    where: {
                        email: booking.user.email,
                        agentId: { not: null }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                if (leadByEmail) {
                    agentId = leadByEmail.agentId;
                    console.log(`Found agent ${agentId} via email fallback for booking ${bookingId}`);
                }
            }

            if (!agentId) {
                console.log(`No agent found for booking ${bookingId}`);
                return;
            }

            const agent = await prisma.agent.findUnique({ where: { id: agentId } });
            if (!agent) return;

            // Check availability
            const existingCommission = await prisma.commission.findFirst({
                where: { bookingId: booking.id }
            });

            if (existingCommission) {
                console.log(`Commission already exists for booking ${bookingId}`);
                return;
            }

            // Calculate Amount
            // Booking Total Price * (Commission Rate / 100)
            const bookingAmount = parseFloat(booking.totalPrice || 0);
            const commissionRate = parseFloat(agent.commissionRate || 0);
            const commissionAmount = (bookingAmount * commissionRate) / 100;

            if (commissionAmount <= 0) return;

            // Create Commission Record
            await prisma.commission.create({
                data: {
                    agentId: agent.id,
                    bookingId: booking.id,
                    amount: commissionAmount,
                    rateSnapshot: commissionRate,
                    status: 'PENDING'
                }
            });

            // Update Agent Stats
            await prisma.agent.update({
                where: { id: agent.id },
                data: {
                    totalDeals: { increment: 1 }
                }
            });

            console.log(`Commission of ${commissionAmount} calculated for Agent ${agent.id} on Booking ${bookingId}`);
        }
    } catch (error) {
        console.error('Calculate Commission Error:', error);
    }

};

// Get Agent Commissions
const getAgentCommissions = async (req, res) => {
    try {
        const { agentId } = req.params;
        const tenantId = req.user?.tenantId;

        // Verify access
        // Admin/Owner can see any. Agent can see own.
        // TODO: Access control checks.

        const commissions = await prisma.commission.findMany({
            where: { agentId },
            include: {
                booking: {
                    select: {
                        id: true,
                        totalPrice: true,
                        status: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { commissions }
        });

    } catch (error) {
        console.error('Get commissions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    calculateCommission,
    getAgentCommissions
};

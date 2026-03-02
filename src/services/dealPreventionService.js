const { prisma } = require('../config/database');

/**
 * Deal Prevention & Risk Management Service
 * Identifies high-risk leads before they are lost
 */
class DealPreventionService {
    /**
     * Analyzes all active leads for a tenant and updates their risk scores
     */
    async scanTenantLeads(tenantId) {
        try {
            const activeLeads = await prisma.lead.findMany({
                where: {
                    tenantId,
                    status: { in: [1, 2, 3] } // New, Contacted, Qualified
                },
                include: {
                    interactions: {
                        orderBy: { occurredAt: 'desc' },
                        take: 5
                    }
                }
            });

            console.log(`[DealPrevention] Scanning ${activeLeads.length} active leads for tenant ${tenantId}`);

            for (const lead of activeLeads) {
                await this.calculateAndSaveRisk(lead);
            }
        } catch (error) {
            console.error('[DealPrevention] Scan error:', error);
        }
    }

    /**
     * Logic to calculate risk score for a single lead
     */
    async calculateAndSaveRisk(lead) {
        let score = 0;
        let signals = [];

        const now = new Date();
        const lastActivityAt = lead.lastActivityAt || lead.updatedAt || lead.createdAt;
        const hoursSinceActivity = (now - new Date(lastActivityAt)) / (1000 * 60 * 60);

        // 1. Idle Thresholds (SLA)
        if (hoursSinceActivity > 72) {
            score += 40;
            signals.push(`Extreme Idle: No activity for ${Math.floor(hoursSinceActivity / 24)} days`);
        } else if (hoursSinceActivity > 36) {
            score += 20;
            signals.push("Warning: No follow-up in 36+ hours");
        }

        // 2. Status Stagnation
        const daysInStatus = (now - new Date(lead.updatedAt)) / (1000 * 60 * 60 * 24);
        if (lead.status === 3 && daysInStatus > 7) { // Qualified but stuck
            score += 25;
            signals.push("Stuck in 'Qualified' for over a week");
        }

        // 3. Sentiment Analysis (Basic Regex on Notes/Message)
        const combinedText = `${lead.notes || ''} ${lead.message || ''}`.toLowerCase();
        const negativeKeywords = [
            { word: 'expensive', weight: 15, msg: "Price objection detected" },
            { word: 'budget', weight: 10, msg: "Budget constraints mentioned" },
            { word: 'postpone', weight: 20, msg: "Closure delay requested" },
            { word: 'competitor', weight: 25, msg: "Evaluating competitors" },
            { word: 'wait', weight: 10, msg: "Hesitation detected" },
            { word: 'no response', weight: 15, msg: "Communication gap noted" }
        ];

        negativeKeywords.forEach(k => {
            if (combinedText.includes(k.word)) {
                score += k.weight;
                signals.push(k.msg);
            }
        });

        // 4. Low Interaction Frequency
        if (lead.interactions.length < 2 && hoursSinceActivity > 48) {
            score += 15;
            signals.push("Low engagement: Very few interactions recorded");
        }

        // Cap score at 95 (leaving room for humans to mark 100)
        const finalScore = Math.min(score, 95);

        // OPTIMIZATION: Only update if anything changed
        const currentSignals = JSON.stringify(lead.riskSignals || []);
        const newSignals = JSON.stringify(signals);

        if (lead.riskScore !== finalScore || currentSignals !== newSignals) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    riskScore: finalScore,
                    riskSignals: signals
                }
            });
        }

        return { score: finalScore, signals };
    }

    /**
     * Get actionable coaching for an agent based on their lead risk profile
     */
    async getAgentCoaching(agentId, tenantId) {
        const atRiskLeads = await prisma.lead.findMany({
            where: {
                tenantId,
                status: { in: [1, 2, 3] },
                riskScore: { gt: 50 },
                agentLeads: {
                    some: { agentId, status: 1 }
                }
            },
            include: {
                tasks: {
                    where: { status: { in: [1, 2] } },
                    take: 1
                }
            },
            orderBy: { riskScore: 'desc' }
        });


        const mostCommonSignals = {};
        atRiskLeads.forEach(l => {
            const signals = Array.isArray(l.riskSignals) ? l.riskSignals : [];
            signals.forEach(s => {
                mostCommonSignals[s] = (mostCommonSignals[s] || 0) + 1;
            });
        });

        return {
            highRiskCount: atRiskLeads.length,
            topLeaks: Object.entries(mostCommonSignals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([signal, count]) => ({ signal, count })),
            urgentActions: atRiskLeads.slice(0, 5).map(l => ({
                id: l.id,
                name: l.name,
                riskScore: l.riskScore,
                taskStatus: l.tasks?.[0]?.status || 0,
                topSignal: (Array.isArray(l.riskSignals) && l.riskSignals.length > 0) ? l.riskSignals[0] : 'Idle'
            }))

        };
    }
}

module.exports = new DealPreventionService();

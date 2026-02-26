const { prisma } = require('../config/database');
const dealPreventionService = require('../services/dealPreventionService');

module.exports = {
    getPreventionInsights: async (req, res) => {
        try {
            const tenantId = req.user?.tenantId || req.tenant?.id;

            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant ID is required for analytics' });
            }

            const [highRiskLeads, agents] = await Promise.all([
                prisma.lead.findMany({
                    where: { tenantId, status: { in: [1, 2, 3] }, riskScore: { gt: 60 } },
                    orderBy: { riskScore: 'desc' },
                    take: 10,
                    include: {
                        agentLeads: { where: { status: 1 }, include: { agent: { include: { user: { select: { name: true } } } } } },
                        tasks: {
                            where: { status: { in: [1, 2] } },
                            include: { agent: { include: { user: { select: { name: true } } } } },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }),
                prisma.agent.findMany({
                    where: { tenantId },
                    include: { user: { select: { name: true } } }
                })
            ]);


            // Aggregate Agent Coaching Suggestions
            const agentCoachingList = await Promise.all(agents.map(async agent => {
                try {
                    const coaching = await dealPreventionService.getAgentCoaching(agent.id, tenantId);
                    return {
                        agentId: agent.id,
                        name: agent.user?.name || 'Unknown Agent',
                        ...coaching
                    };
                } catch (coachingError) {
                    console.error(`[DealPrevention] Coaching failed for agent ${agent.id}:`, coachingError);
                    return null;
                }
            }));

            const filteredCoaching = agentCoachingList.filter(a => a && a.highRiskCount > 0);

            // Calculate overall risk signals for the tenant
            const signalsAgg = {};
            const allActiveLeads = await prisma.lead.findMany({
                where: { tenantId, status: { in: [1, 2, 3] } },
                select: { riskSignals: true }
            });

            allActiveLeads.forEach(l => {
                const signals = Array.isArray(l.riskSignals) ? l.riskSignals : [];
                signals.forEach(s => {
                    signalsAgg[s] = (signalsAgg[s] || 0) + 1;
                });
            });

            res.status(200).json({
                success: true,
                data: {
                    highRiskDeals: highRiskLeads.map(l => ({
                        id: l.id,
                        name: l.name,
                        score: l.riskScore,
                        signals: Array.isArray(l.riskSignals) ? l.riskSignals : [],
                        agent: l.agentLeads[0]?.agent?.user?.name || 'Unassigned',
                        agentId: l.agentLeads[0]?.agent?.id,
                        taskStatus: l.tasks?.[0]?.status || 0,
                        currentAssignee: l.tasks?.[0]?.agent?.user?.name || null
                    })),


                    topRiskSignals: Object.entries(signalsAgg)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([signal, count]) => ({ signal, count })),
                    agentCoaching: filteredCoaching
                }
            });

        } catch (error) {
            console.error('Error fetching prevention insights:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    getLostDealsIntelligence: async (req, res) => {
        try {
            const tenantId = req.user.tenantId;

            const [totalLost, lossDataRaw, employeeData, topProjects] = await Promise.all([
                prisma.leadLossData.count({ where: { tenantId } }),
                prisma.leadLossData.findMany({ where: { tenantId } }),

                // Employee Analysis: Group Leads by Agent where lead loss data exists
                prisma.agentLead.findMany({
                    where: {
                        lead: { tenantId, status: 5, lossData: { isNot: null } }
                    },
                    include: {
                        agent: {
                            include: {
                                user: { select: { name: true } }
                            }
                        },
                        lead: { include: { lossData: true } }
                    }
                }),

                // Project Analysis (When reason is Chose another project, but also our properties where leads were lost)
                prisma.lead.findMany({
                    where: { tenantId, status: 5, propertyId: { not: null }, lossData: { isNot: null } },
                    include: {
                        property: { select: { title: true } },
                        lossData: true
                    }
                })
            ]);

            // Calculate Stage Loss Rate
            const stageCounts = { 'Enquiry': 0, 'Site Visit': 0, 'Negotiation': 0, 'Booking': 0 };
            const reasonsCounts = {};
            let totalWeightedValue = 0;

            lossDataRaw.forEach(l => {
                if (stageCounts[l.stageAtLoss] !== undefined) stageCounts[l.stageAtLoss]++;
                else stageCounts[l.stageAtLoss] = 1;

                reasonsCounts[l.primaryReason] = (reasonsCounts[l.primaryReason] || 0) + 1;
                totalWeightedValue += Number(l.lostImpactScore) || 0;
            });

            const topReasons = Object.entries(reasonsCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([reason, count]) => ({ reason, count }));

            // Employee level metrics
            const employeeLossAgg = {};
            employeeData.forEach(al => {
                const agentName = al.agent?.user?.name || 'Unassigned';
                if (!employeeLossAgg[agentName]) employeeLossAgg[agentName] = { lost: 0, weightedValue: 0 };
                employeeLossAgg[agentName].lost++;
                employeeLossAgg[agentName].weightedValue += Number(al.lead?.lossData?.lostImpactScore) || 0;
            });

            // Project level metrics
            const projectLossAgg = {};
            topProjects.forEach(lead => {
                const title = lead.property?.title || 'Unknown Project';
                if (!projectLossAgg[title]) projectLossAgg[title] = { lost: 0, topReasonMap: {} };
                projectLossAgg[title].lost++;

                const reason = lead.lossData?.primaryReason;
                if (reason) projectLossAgg[title].topReasonMap[reason] = (projectLossAgg[title].topReasonMap[reason] || 0) + 1;
            });

            const formattedProjects = Object.entries(projectLossAgg).map(([title, data]) => {
                // Find top reason
                const topR = Object.entries(data.topReasonMap).sort((a, b) => b[1] - a[1])[0];
                return {
                    title,
                    lostCount: data.lost,
                    topReason: topR ? topR[0] : 'N/A'
                };
            });

            res.status(200).json({
                success: true,
                data: {
                    metrics: {
                        totalLost,
                        totalWeightedValue,
                        lossRateByStage: Object.entries(stageCounts)
                            .filter(([_, count]) => count > 0)
                            .map(([stage, count]) => ({ stage, count }))
                    },
                    topReasons,
                    employeeAnalysis: Object.entries(employeeLossAgg).map(([agent, stats]) => ({ agent, ...stats })).sort((a, b) => b.lost - a.lost),
                    projectAnalysis: formattedProjects.sort((a, b) => b.lostCount - a.lostCount)
                }
            });

        } catch (error) {
            console.error('Error fetching deal intelligence:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
};

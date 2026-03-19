const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanData() {
  console.log('🧹 Starting total database cleanup...');

  try {
    // ─── CLEAN (reverse dependency order to respect foreign keys) ──────────────
    await prisma.workflowLog.deleteMany();
    await prisma.workflowEnrollment.deleteMany();
    await prisma.marketingWorkflow.deleteMany();
    await prisma.campaignLog.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.audienceGroup.deleteMany();
    await prisma.emailTemplate.deleteMany();
    await prisma.formBuilder.deleteMany();
    await prisma.whatsAppMessage.deleteMany();
    await prisma.whatsAppCampaign.deleteMany();
    await prisma.whatsAppTemplate.deleteMany();
    await prisma.whatsAppChatbot.deleteMany();
    await prisma.publishedPost.deleteMany();
    await prisma.scheduledPost.deleteMany();
    await prisma.connectedAccount.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.agentLead.deleteMany();
    await prisma.agentProperty.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.leadInteraction.deleteMany();
    await prisma.leadLossData.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.task.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.portalListing.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.planUpgradeRequest.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.widget.deleteMany();
    await prisma.websitePopup.deleteMany();
    await prisma.page.deleteMany();
    await prisma.website.deleteMany();
    await prisma.media.deleteMany();
    await prisma.userPropertyAccess.deleteMany();
    await prisma.property3DConfig.deleteMany();
    await prisma.propertyAmenity.deleteMany();
    await prisma.unitAmenity.deleteMany();
    await prisma.realEstateUnitDetails.deleteMany();
    await prisma.unitPricing.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.property.deleteMany();
    await prisma.propertyCategory.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.licenseKey.deleteMany();
    await prisma.tenantModule.deleteMany();
    await prisma.module.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.partnerProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.systemSetting.deleteMany();

    console.log('✨ All data successfully cleared from the database.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanData();

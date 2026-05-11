const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { sendPartnerWelcomeEmail } = require('../utils/emailService');

// Role 5 is dedicated to Partners
const ROLE_PARTNER = 5;

// Partner Status in User table: 1: ACTIVE (Approved), 2: INACTIVE (Pending), 3: DEACTIVATED (Rejected)
// I'll stick to 1: Approved, 0 or 2: Pending, 3: Rejected based on existing patterns.
// In authController.js: 1: Active, 2: Inactive. I'll use 2 for Pending.

/**
 * Generate JWT token for Partner (Same as standard user, but with Role 5)
 */
const generateToken = (userId) => {
  return jwt.sign({ userId, role: ROLE_PARTNER }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Register a new Partner application (Creates User + PartnerProfile)
 */
const registerPartner = async (req, res) => {
  try {
    const {
      email,
      password,
      companyName,
      website,
      monthlyClientBase,
      country,
      salesCapability,
      tenantId: bodyTenantId,
      tenantType
    } = req.body;

    // Determine tenantId: From middleware (req.tenant), body, or find by type
    let tenantId = req.tenant?.id || bodyTenantId;

    if (!tenantId && tenantType) {
      const parsedType = parseInt(tenantType);
      if (!isNaN(parsedType)) {
        // Find first tenant of this type (e.g. 1: Real Estate, 2: Coworking)
        const hostTenant = await prisma.tenant.findFirst({
          where: { type: parsedType, status: 1 }
        });
        if (hostTenant) {
          tenantId = hostTenant.id;
        }
      }
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context or valid Industry Type is required for partner registration'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User (Role 5, Status 2/Pending) and PartnerProfile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          companyName,
          website,
          country,
          role: ROLE_PARTNER,
          status: 2, // PENDING/INACTIVE
          isVerified: false,
          name: companyName, // Use company name as display name
          tenantId: tenantId // Multi-tenant isolation
        }
      });

      const profile = await tx.partnerProfile.create({
        data: {
          userId: user.id,
          tenantId: tenantId, // Multi-tenant isolation
          companyName,
          website,
          monthlyClientBase,
          country,
          salesCapability
        }
      });

      return { user, profile };
    });

    // Send Welcome Email (Background)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, customDomain: true, settings: true }
    }).catch(() => null);
    
    const themeConfig = {
      name: tenant?.name,
      customDomain: tenant?.customDomain,
      emailSkinColor: tenant?.settings?.emailSkinColor
    };

    sendPartnerWelcomeEmail(email, companyName, themeConfig).catch(emailError => {
      console.error('Non-blocking error: Partner welcome email failed:', emailError);
    });

    res.status(201).json({
      success: true,
      message: 'Partner application submitted successfully. Our team will review your profile.',
      data: {
        id: result.user.id,
        email: result.user.email,
        status: result.user.status,
        tenantId: result.user.tenantId
      }
    });

  } catch (error) {
    console.error('Partner registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during partner registration'
    });
  }
};

/**
 * Admin: List all partner applications (Users with role 5)
 */
const adminListPartners = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const partners = await prisma.user.findMany({
      where: { 
        role: ROLE_PARTNER,
        ...(tenantId && { tenantId })
      },
      include: { partnerProfile: true },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: { partners }
    });
  } catch (error) {
    console.error('Admin list partners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching partner list'
    });
  }
};

const adminUpdatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, partnerType } = req.body;
    const tenantId = req.tenant?.id;

    const user = await prisma.user.update({
      where: { 
        id,
        ...(tenantId && { tenantId })
      },
      data: {
        ...(status !== undefined && { status: parseInt(status) })
      },
      include: { partnerProfile: true }
    });

    res.status(200).json({
      success: true,
      message: 'Partner updated successfully',
      data: { partner: user }
    });
  } catch (error) {
    console.error('Admin update partner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating partner'
    });
  }
};

/**
 * Admin: Get Partner Detail with referred clients and earnings
 */
const adminGetPartnerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const partner = await prisma.user.findUnique({
      where: { 
        id,
        role: ROLE_PARTNER,
        ...(tenantId && { tenantId })
      },
      include: { 
        partnerProfile: true,
        referredTenants: {
          include: {
            plan: true,
            _count: {
              select: { users: true, properties: true, units: true, bookings: true }
            }
          }
        }
      }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    const { passwordHash: _, ...partnerData } = partner;

    // Mock some analytics if not in DB yet
    const analytics = {
      totalRevenueGenerated: partner.referredTenants.reduce((sum, t) => sum + (Number(t.plan?.price) || 0), 0),
      activeClients: partner.referredTenants.filter(t => t.status === 1).length,
      conversionRate: partner.referredTenants.length > 0 ? (partner.referredTenants.filter(t => t.status === 1).length / partner.referredTenants.length) * 100 : 0,
      monthlyEarnings: (Number(partner.partnerProfile?.commissionBalance) || 0) * 0.1 // Simplified mock
    };

    res.status(200).json({
      success: true,
      data: { 
        partner: partnerData,
        analytics
      }
    });
  } catch (error) {
    console.error('Admin get partner detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching partner detail'
    });
  }
};

/**
 * Admin: Send Confirmation Email to Partner
 */
const adminSendConfirmationEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const partner = await prisma.user.findUnique({
      where: { id, role: ROLE_PARTNER },
      include: { partnerProfile: true }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    const { sendAccountConfirmationEmail } = require('../utils/emailService');
    const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null;
    
    await sendAccountConfirmationEmail(partner.email, partner.name || partner.companyName, tenant || {});

    res.status(200).json({
      success: true,
      message: 'Confirmation email sent successfully'
    });
  } catch (error) {
    console.error('Admin send confirmation email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending confirmation email'
    });
  }
};

/**
 * Get Partner Profile (for Dashboard)
 */
const getPartnerProfile = async (req, res) => {
  try {
    // req.user is populated by standard 'auth' middleware
    const partner = await prisma.user.findUnique({
      where: { 
        id: req.user.id,
        tenantId: req.user.tenantId
      },
      include: { partnerProfile: true }
    });

    if (!partner || partner.role !== ROLE_PARTNER) {
      return res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
    }

    const { passwordHash: _, ...partnerData } = partner;

    res.status(200).json({
      success: true,
      data: { partner: partnerData }
    });
  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching partner profile'
    });
  }
};

/**
 * Partner: Update own Profile (stored in User + PartnerProfile)
 */
const updatePartnerProfile = async (req, res) => {
  try {
    const {
      firstName, lastName, phone,
      companyName, website, country
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update User
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          firstName,
          lastName,
          phone,
          name: companyName || firstName,
          companyName,
          country
        }
      });

      // 2. Update PartnerProfile
      const profile = await tx.partnerProfile.update({
        where: { userId: req.user.id },
        data: {
          companyName,
          website,
          country
        }
      });

      return { user, profile };
    });

    const { passwordHash: _, ...updatedUser } = result.user;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { partner: { ...updatedUser, partnerProfile: result.profile } }
    });

  } catch (error) {
    console.error('Update partner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

/**
 * Partner: Add a new client account manually
 */
const addPartnerClient = async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, phone,
      companyName, type, // Tenant fields
      country, planId
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A client with this email already exists'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate basic domain slug
    const domainSlug = (companyName || firstName).toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: companyName || `${firstName}'s Workspace`,
          type: type || 1, // Default to Real Estate
          domain: domainSlug,
          country,
          status: 1, // ACTIVE
          referredById: req.user.id, // THE PARTNER WHO ADDED THEM
          planId: planId // Maybe default plan later
        }
      });

      // 2. Create User (Owner)
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: 3, // OWNER
          status: 1, // ACTIVE/VERIFIED
          isVerified: true,
          tenantId: tenant.id
        }
      });

      return { tenant, user };
    });

    res.status(201).json({
      success: true,
      message: 'Client account created and verified successfully.',
      data: { 
        clientId: result.user.id,
        tenantId: result.tenant.id,
        domain: result.tenant.domain
      }
    });

  } catch (error) {
    console.error('Add partner client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating client account: ' + (error.message || 'Internal error')
    });
  }
};

module.exports = {
  registerPartner,
  adminListPartners,
  adminUpdatePartner,
  adminGetPartnerDetail,
  adminSendConfirmationEmail,
  getPartnerProfile,
  updatePartnerProfile,
  addPartnerClient
};

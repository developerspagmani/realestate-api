const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

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
      tenantId: bodyTenantId
    } = req.body;

    // Determine tenantId: From middleware (req.tenant) or body
    const tenantId = req.tenant?.id || bodyTenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for partner registration'
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

/**
 * Admin: Update Partner status/type (stored in User table)
 */
const adminUpdatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, partnerType } = req.body;
    const tenantId = req.tenant?.id;

    // status: 1 (Approved), 3 (Rejected/Deactivated)
    const user = await prisma.user.update({
      where: { 
        id,
        ...(tenantId && { tenantId })
      },
      data: {
        ...(status !== undefined && { status: parseInt(status) })
        // partnerType might need a field in User or Profile. 
        // I'll keep it in Profile if needed, but for now I'll just update status.
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
  getPartnerProfile,
  updatePartnerProfile,
  addPartnerClient
};

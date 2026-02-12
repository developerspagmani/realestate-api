const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: {
          select: {
            subscriptionExpiresAt: true,
            subscriptionStatus: true
          }
        }
      }
    });

    if (!user || user.status !== 1) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error in authentication.'
    });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    // If auth middleware didn't run or failed, req.user won't be set
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.'
      });
    }

    // Convert string roles to numeric for comparison
    const roleMap = {
      'USER': 1,
      'ADMIN': 2,
      'OWNER': 3,
      'AGENT': 4
    };

    // Convert allowed roles to numeric
    const allowedRoles = roles.map(role => roleMap[role] || parseInt(role));

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`[Auth] Access Denied for User ${req.user.id}. Role: ${req.user.role}, Required: ${allowedRoles}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

// Module-based authorization
const checkModule = (moduleSlug) => {
  return async (req, res, next) => {
    // Authentication required first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admins have access to everything
    if (req.user.role === 2) return next();

    // Check if user has a tenant
    if (!req.user.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context required for module access.'
      });
    }

    try {
      // 1. Check if subscription has expired
      if (req.user.tenant?.subscriptionExpiresAt) {
        const expiryDate = new Date(req.user.tenant.subscriptionExpiresAt);
        if (new Date() > expiryDate) {
          return res.status(403).json({
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your trial or subscription has expired. Please upgrade to continue accessing this feature.'
          });
        }
      }

      // 2. Find if module is assigned and active for this tenant
      const assignment = await prisma.tenantModule.findFirst({
        where: {
          tenantId: req.user.tenantId,
          isActive: true,
          module: {
            slug: moduleSlug
          }
        }
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          data: { module: moduleSlug },
          message: `The module '${moduleSlug}' is not enabled for your account. Please contact the administrator.`
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking module ${moduleSlug}:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while verifying module access.'
      });
    }
  };
};

module.exports = { auth, authorize, checkModule };

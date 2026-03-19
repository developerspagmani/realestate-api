const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const partnerAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No partner token provided.'
      });
    }

    // SEC-10 fix: Check if token is blacklisted
    const isBlacklisted = await prisma.blacklistedToken.findUnique({
      where: { token }
    });

    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.partnerId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid partner token structure.'
      });
    }

    // Get partner from database
    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId }
    });

    if (!partner || partner.status !== 1) { // 1: APPROVED
      return res.status(401).json({
        success: false,
        message: 'Invalid partner token or account not approved.'
      });
    }

    // Assign to req.partner (NOT req.user) to keep it isolated
    req.partner = partner;
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
      message: 'Server error in partner authentication.'
    });
  }
};

module.exports = { partnerAuth };

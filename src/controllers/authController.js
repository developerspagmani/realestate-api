const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { sendActivationEmail, sendResetPasswordEmail } = require('../utils/emailService');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Register user (and optional Tenant)
const register = async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, phone,
      companyName, spaceName, type, // Tenant fields
      website, addressLine1, addressLine2, city, state, country, zipCode
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Determine if this is an Owner registration (Tenant creation)
    const isOwnerRegistration = !!(companyName || spaceName);
    const tenantName = companyName || spaceName;
    const tenantType = type || 1; // Default to 1 (Real Estate) if not specified

    // Transaction to create Tenant and User
    const result = await prisma.$transaction(async (prisma) => {
      let tenant = null;

      if (isOwnerRegistration) {
        // Generate basic domain slug (optional log, can be refined)
        const domainSlug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);

        tenant = await prisma.tenant.create({
          data: {
            name: tenantName,
            type: tenantType,
            domain: domainSlug,
            website,
            address: [addressLine1, addressLine2].filter(Boolean).join(', '),
            city,
            state,
            country,
            postalCode: zipCode,
            status: 1
          }
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate activation token
      const activationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
          phone,
          companyName,
          website,
          addressLine1,
          addressLine2,
          city,
          state,
          country,
          zipCode,
          role: isOwnerRegistration ? 3 : 1, // 3: Owner, 1: User
          tenantId: tenant ? tenant.id : undefined,
          status: 2, // 2: Inactive / Pending Verification
          activationToken,
          isVerified: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          activationToken: true
        }
      });

      return { user, tenant };
    });

    const { user, tenant } = result;

    // Send activation email
    await sendActivationEmail(user.email, user.activationToken, user.firstName);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to activate your account.',
      data: {
        email: user.email,
        tenant // Return tenant info if created
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// Verify Email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const user = await prisma.user.findFirst({
      where: { activationToken: token }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired activation link' });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Account is already verified. Please login.'
      });
    }

    // Activate user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 1, // Active
        isVerified: true,
        activationToken: null // Clear token after use (optional, or keep for audit)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find user by email OR phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : null,
          phone ? { phone } : null
        ].filter(Boolean)
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify tenant if tenant domain/ID is provided in headers
    const tenantIdentifier = req.headers['x-tenant-domain'];
    if (tenantIdentifier && user.tenantId) {
      // Check if it matches the user's tenant directly
      if (user.tenantId !== tenantIdentifier) {
        // If it doesn't match the ID, it might be a domain
        const tenant = await prisma.tenant.findUnique({
          where: { domain: tenantIdentifier }
        });

        // If a tenant was found by domain but it doesn't match the user's tenant
        if (tenant && user.tenantId !== tenant.id) {
          return res.status(401).json({
            success: false,
            message: 'User does not belong to this tenant or invalid domain'
          });
        }

        // If no tenant was found at all by that identifier (ID or domain), 
        // it might be a stale cookie. We'll ignore it to allow login.
        // If a tenant WAS found but didn't match, we already returned 401.
      }
    }

    // Check if user is active (status === 1 means active)
    if (user.status !== 1) {
      if (user.status === 2) {
        return res.status(401).json({
          success: false,
          message: 'Account not activated. Please check your email.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Update last login (if you have this field)
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { lastLogin: new Date() }
    // });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          tenantId: user.tenantId,
        },
        token,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        tenantId: true,
        // avatar: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user data'
    });
  }
};

// Update password
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: hashedNewPassword }
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating password'
    });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // For security reasons, don't reveal if user exists
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent it a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires
      }
    });

    // Send email
    await sendResetPasswordEmail(user.email, resetToken, user.firstName || user.name);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, we have sent it a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
};

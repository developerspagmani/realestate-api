const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { SubscriptionStatus } = require('../constants');
const { sendActivationEmail, sendResetPasswordEmail, sendAccountConfirmationEmail } = require('../utils/emailService');

// Generate JWT token (includes role for frontend middleware authorization)
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// SEC-09 fix: In-memory brute force protection
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const checkLoginAttempts = (identifier) => {
  const attempts = loginAttempts.get(identifier);
  if (!attempts) return { allowed: true };

  // Reset if lockout expired
  if (attempts.lockedUntil && Date.now() > attempts.lockedUntil) {
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  if (attempts.lockedUntil) {
    const remainingMs = attempts.lockedUntil - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    return { allowed: false, remainingMins };
  }

  return { allowed: true };
};

const recordFailedLogin = (identifier) => {
  const attempts = loginAttempts.get(identifier) || { count: 0 };
  attempts.count += 1;

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }

  loginAttempts.set(identifier, attempts);
};

const clearLoginAttempts = (identifier) => {
  loginAttempts.delete(identifier);
};

// Register user (and optional Tenant)
const register = async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, phone,
      companyName, spaceName, type, // Tenant fields
      website, addressLine1, addressLine2, city, state, country, zipCode,
      planId, licenseKey // New fields
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
    const result = await prisma.$transaction(async (tx) => {
      let tenant = null;

      if (isOwnerRegistration) {
        let actualPlanId = planId;

        // Validation for License Key if provided
        if (licenseKey) {
          const keyRecord = await tx.licenseKey.findUnique({
            where: { key: licenseKey }
          });

          if (!keyRecord || keyRecord.status !== 1) {
            throw new Error('License key is invalid or has already been used');
          }

          if (planId && keyRecord.planId !== planId) {
            throw new Error('License key is not valid for the selected plan');
          }

          actualPlanId = keyRecord.planId;
        }

        // Generate basic domain slug
        const domainSlug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);

        // Fetch default trial period from settings
        const trialSetting = await tx.systemSetting.findUnique({
          where: { key: 'default_trial_days' }
        });
        const trialDays = trialSetting ? parseInt(trialSetting.value) : 15;

        tenant = await tx.tenant.create({
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
            status: 1,
            planId: actualPlanId || undefined,
            subscriptionStatus: licenseKey ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIAL,
            subscriptionExpiresAt: licenseKey
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          }
        });

        // Mark License Key as used if provided
        if (licenseKey) {
          const keyRecord = await tx.licenseKey.update({
            where: { key: licenseKey },
            data: {
              status: 2, // Used
              tenantId: tenant.id,
              activatedAt: new Date(),
              userId: null // We'll link this after user is created
            },
            include: {
              plan: {
                include: {
                  modules: true
                }
              }
            }
          });

          // Assign modules from plan to tenant
          if (keyRecord.plan && keyRecord.plan.modules) {
            const moduleAssignments = keyRecord.plan.modules.map(mod => ({
              tenantId: tenant.id,
              moduleId: mod.id,
              isActive: true
            }));

            if (moduleAssignments.length > 0) {
              await tx.tenantModule.createMany({
                data: moduleAssignments
              });
            }
          }
        } else {
          // New owner registration without key -> Assign all active modules for trial
          const allModules = await tx.module.findMany({ where: { status: 1 } });
          if (allModules.length > 0) {
            await tx.tenantModule.createMany({
              data: allModules.map(mod => ({
                tenantId: tenant.id,
                moduleId: mod.id,
                isActive: true
              }))
            });
          }
        }
      }


      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate activation token
      const activationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
          phone,
          role: isOwnerRegistration ? 3 : 1, // 3: Owner, 1: User
          tenantId: tenant ? tenant.id : null,
          activationToken,
          status: 2, // Inactive
          isVerified: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          activationToken: true,
          tenantId: true
        }
      });

      // Link License Key to User if provided
      if (licenseKey) {
        await tx.licenseKey.update({
          where: { key: licenseKey },
          data: { userId: user.id }
        });
      }


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

    // Send confirmation/welcome email
    await sendAccountConfirmationEmail(user.email, user.firstName || user.name);

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
    const loginIdentifier = email || phone;

    // SEC-09: Check brute force lockout
    const attemptCheck = checkLoginAttempts(loginIdentifier);
    if (!attemptCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${attemptCheck.remainingMins} minute(s).`
      });
    }

    // Find user by email OR phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : null,
          phone ? { phone } : null
        ].filter(Boolean)
      },
      include: {
        tenant: true
      }
    });

    if (!user) {
      recordFailedLogin(loginIdentifier);
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
      recordFailedLogin(loginIdentifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // SEC-09: Clear failed attempts on successful login
    clearLoginAttempts(loginIdentifier);

    // Generate token
    const token = generateToken(user.id, user.role);

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
          subscriptionStatus: user.tenant?.subscriptionStatus || (user.role === 3 ? 3 : 1),
          subscriptionExpiresAt: user.tenant?.subscriptionExpiresAt || null
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
      include: {
        tenant: {
          select: {
            subscriptionStatus: true,
            subscriptionExpiresAt: true
          }
        }
      }
    });

    const userData = {
      ...user,
      subscriptionStatus: user.tenant?.subscriptionStatus || (user.role === 3 ? 3 : 1),
      subscriptionExpiresAt: user.tenant?.subscriptionExpiresAt || null
    };
    delete userData.tenant;

    res.status(200).json({
      success: true,
      data: { user: userData }
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

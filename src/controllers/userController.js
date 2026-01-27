const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');
const cacheService = require('../utils/cacheService');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const cacheKey = `user:${req.user.id}:profile`;

    // Check cache
    const cachedProfile = await cacheService.get(cacheKey);
    if (cachedProfile) {
      return res.status(200).json({
        success: true,
        data: { user: cachedProfile }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        phone: true,
        companyName: true,
        website: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        zipCode: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Set cache (5 minutes)
    await cacheService.set(cacheKey, user, 300);

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

// Update user profile (logged in user)
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...req.body // Spread body to catch all new fields like firstName, lastName, etc.
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        phone: true,
        companyName: true,
        website: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        zipCode: true,
        role: true,
        updatedAt: true,
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// Management Endpoints

// Get users list (Role-based)
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      tenantId: queryTenantId,
      industryType
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAdmin = req.user.role === 2;
    // For admins, only use provided tenantId filters, don't default to their account's tenantId
    const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

    // For system admins, tenantId is optional to see all users across tenants
    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) where.role = parseInt(role);
    if (status) where.status = parseInt(status);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          phone: true,
          companyName: true,
          website: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          country: true,
          zipCode: true,
          role: true,
          status: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bookings: true,
              userPropertyAccess: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
};

// Get single user details
const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        phone: true,
        companyName: true,
        website: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        zipCode: true,
        role: true,
        status: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            userPropertyAccess: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user details' });
  }
};

// Create a new user (Admin/Owner)
const createUser = async (req, res) => {
  try {
    const { email, password, name, phone, role, tenantId, status } = req.body;

    // Authorization checks
    let userRole = parseInt(role) || 1;
    let userTenantId = tenantId;

    if (req.user.role === 3) { // OWNER
      // Owners can only create USERS (role 1) for their own tenant
      userRole = 1;
      userTenantId = req.user.tenantId;
    } else if (req.user.role === 2) { // ADMIN
      // Admins can create any role for any tenant
      // (though role 2 is usually reserved for super admins)
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        name: name || `${req.body.firstName} ${req.body.lastName}`,
        phone,
        companyName: req.body.companyName,
        website: req.body.website,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zipCode: req.body.zipCode,
        role: userRole,
        tenantId: userTenantId,
        status: status ? parseInt(status) : 1
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
};

// Update user details (Admin/Owner)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, name, phone, tenantId } = req.body;

    // Check if user exists and belongs to same tenant if OWNER
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.role === 3 && targetUser.tenantId !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update users in other tenants' });
    }

    const data = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(status !== undefined && { status: parseInt(status) }),
    };

    // Only Admin can change role or tenantId
    if (req.user.role === 2) {
      if (role !== undefined) data.role = parseInt(role);
      if (tenantId !== undefined) data.tenantId = tenantId;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        updatedAt: true,
      }
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
};

// Delete user (Admin/Owner)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.role === 3 && targetUser.tenantId !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.$transaction(async (tx) => {
      // In practice, we might want to soft delete or keep records
      // But for this request, we perform actual deletion of related non-critical data
      // For Bookings, we should probably set userId to null instead of deleting

      await tx.userPropertyAccess.deleteMany({ where: { userId: id } });
      await tx.auditLog.deleteMany({ where: { userId: id } });

      // Update bookings to have null userId so history is preserved
      await tx.booking.updateMany({
        where: { userId: id },
        data: { userId: null }
      });

      await tx.user.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
};

// Owner Detail Endpoints (Admin only)

const getOwnerStats = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = await prisma.user.findUnique({
      where: { id },
      select: { tenantId: true }
    });

    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const [propertyCount, unitCount, bookingCount, userCount, totalRevenue] = await Promise.all([
      prisma.property.count({ where: { tenantId: owner.tenantId } }),
      prisma.unit.count({ where: { tenantId: owner.tenantId } }),
      prisma.booking.count({ where: { tenantId: owner.tenantId } }),
      prisma.user.count({ where: { tenantId: owner.tenantId, role: 1 } }),
      prisma.booking.aggregate({
        where: { tenantId: owner.tenantId, status: { in: [2, 4] } },
        _sum: { totalPrice: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        propertyCount,
        unitCount,
        bookingCount,
        userCount,
        totalRevenue: totalRevenue._sum.totalPrice || 0
      }
    });
  } catch (error) {
    console.error('Get owner stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching owner stats' });
  }
};

const getOwnerProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const properties = await prisma.property.findMany({
      where: { tenantId: owner.tenantId },
      include: {
        _count: { select: { units: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: { properties } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching owner properties' });
  }
};

const getOwnerUnits = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const units = await prisma.unit.findMany({
      where: { tenantId: owner.tenantId },
      include: {
        property: { select: { title: true } },
        unitPricing: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: { units } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching owner units' });
  }
};

const getOwnerBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const bookings = await prisma.booking.findMany({
      where: { tenantId: owner.tenantId },
      include: {
        user: { select: { name: true, email: true } },
        unit: { select: { unitCode: true, property: { select: { title: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching owner bookings' });
  }
};

const getOwnerUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const users = await prisma.user.findMany({
      where: { tenantId: owner.tenantId, role: 1 },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching owner users' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getOwnerStats,
  getOwnerProperties,
  getOwnerUnits,
  getOwnerBookings,
  getOwnerUsers,
  getUser
};

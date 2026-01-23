const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const { tenantId: queryTenantId, ownerId, industryType } = req.query;
    const isAdmin = req.user.role === 2;
    const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    // Common where clauses
    const whereBase = {};
    if (tenantId) whereBase.tenantId = tenantId;
    if (industryType) {
      whereBase.tenant = { type: parseInt(industryType) };
    }

    // Owner filtering logic
    let finalOwnerFilter = {};
    let finalBookingOwnerFilter = {};

    const isActuallyOwner = req.user.role === 3;
    const effectiveOwnerId = isActuallyOwner ? req.user.id : (isAdmin && ownerId ? ownerId : null);

    if (effectiveOwnerId) {
      // Check if this user has specific property access records
      const hasAccessRecords = await prisma.userPropertyAccess.count({
        where: { userId: effectiveOwnerId, tenantId: tenantId || undefined }
      });

      if (hasAccessRecords > 0) {
        finalOwnerFilter = {
          userPropertyAccess: { some: { userId: effectiveOwnerId } }
        };
        finalBookingOwnerFilter = {
          unit: { property: { userPropertyAccess: { some: { userId: effectiveOwnerId } } } }
        };
      }
    }

    const finalWhereBase = { ...whereBase };

    const [
      totalUsers,
      totalProperties,
      totalUnits,
      totalBookings,
      activeBookings,
      completedBookings,
      totalRevenue,
      recentBookings,
      topWorkspaces,
      totalOwners
    ] = await Promise.all([
      prisma.user.count({
        where: {
          status: 1,
          ...finalWhereBase,
          ...(ownerId ? { id: ownerId } : {})
        }
      }),
      prisma.property.count({
        where: {
          status: 1,
          ...finalWhereBase,
          ...finalOwnerFilter
        }
      }),
      prisma.unit.count({
        where: {
          status: 1,
          ...finalWhereBase,
          property: finalOwnerFilter
        }
      }),
      prisma.booking.count({
        where: {
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        }
      }),
      prisma.booking.count({
        where: {
          status: 2, // Confirmed (Active)
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        }
      }),
      prisma.booking.count({
        where: {
          status: 4, // Completed
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        }
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: [2, 4] },
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        },
        _sum: { totalPrice: true }
      }),
      prisma.booking.findMany({
        where: {
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          unit: {
            select: { id: true, unitCode: true, unitCategory: true }
          }
        }
      }),
      prisma.booking.groupBy({
        by: ['unitId'],
        where: {
          status: 4,
          ...finalWhereBase,
          ...finalBookingOwnerFilter
        },
        _count: { id: true },
        _sum: { totalPrice: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),
      prisma.user.count({
        where: {
          role: 3, // OWNER role
          ...finalWhereBase
        }
      })
    ]);

    // Get unit details for top workspaces
    const topWorkspaceDetails = await Promise.all(
      topWorkspaces.map(async (item) => {
        const unit = await prisma.unit.findUnique({
          where: { id: item.unitId },
          select: {
            id: true,
            unitCode: true,
            unitCategory: true,
            property: {
              select: {
                title: true,
                city: true,
              }
            }
          }
        });
        return {
          ...unit,
          bookingCount: item._count.id,
          totalRevenue: item._sum.totalPrice || 0,
        };
      })
    );

    // Calculate pending bookings (status: 1)
    const pendingBookingsCount = await prisma.booking.count({
      where: {
        status: 1,
        ...finalWhereBase,
        ...finalBookingOwnerFilter
      }
    });

    // Calculate history for charts based on period
    const { period = 'last6months', startDate: customStart, endDate: customEnd } = req.query;
    let timeIntervals = [];
    let periodLabel = 'Last 6 Months';

    if (period === 'today') {
      periodLabel = 'Today';
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 24; i += 3) {
        const s = new Date(start);
        s.setHours(i);
        const e = new Date(s);
        e.setHours(i + 3);
        timeIntervals.push({ name: `${i}:00`, start: s, end: e });
      }
    } else if (period === 'yesterday') {
      periodLabel = 'Yesterday';
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 24; i += 3) {
        const s = new Date(start);
        s.setHours(i);
        const e = new Date(s);
        e.setHours(i + 3);
        timeIntervals.push({ name: `${i}:00`, start: s, end: e });
      }
    } else if (period === 'last30days') {
      periodLabel = 'Last 30 Days';
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const e = new Date(d);
        e.setHours(23, 59, 59, 999);
        timeIntervals.push({ name: d.getDate().toString(), start: d, end: e });
      }
    } else if (period === 'custom' && customStart && customEnd) {
      periodLabel = 'Custom Range';
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);

      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 2) {
        // Hourly breakdown for very short ranges
        for (let i = 0; i < diffDays * 24; i += 4) {
          const s = new Date(start);
          s.setHours(s.getHours() + i);
          const e = new Date(s);
          e.setHours(e.getHours() + 4);
          timeIntervals.push({ name: s.getHours() + ':00', start: s, end: e });
        }
      } else {
        // Daily breakdown or group by steps
        const step = Math.max(1, Math.ceil(diffDays / 12));
        for (let i = 0; i < diffDays; i += step) {
          const s = new Date(start);
          s.setDate(s.getDate() + i);
          const e = new Date(s);
          e.setDate(e.getDate() + step);
          if (e > end) e.setTime(end.getTime());
          timeIntervals.push({ name: s.toLocaleDateString('default', { month: 'short', day: 'numeric' }), start: s, end: e });
          if (e >= end) break;
        }
      }
    } else {
      // Default: Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        timeIntervals.push({
          name: d.toLocaleString('default', { month: 'short' }),
          start: new Date(d.getFullYear(), d.getMonth(), 1),
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        });
      }
    }

    // Get property IDs if owner filter is active to filter leads correctly
    let leadOwnerFilter = {};
    if (effectiveOwnerId) {
      const accessibleProperties = await prisma.userPropertyAccess.findMany({
        where: { userId: effectiveOwnerId, tenantId: tenantId || undefined },
        select: { propertyId: true }
      });
      if (accessibleProperties.length > 0) {
        const propertyIds = accessibleProperties.map(p => p.propertyId);
        leadOwnerFilter = { propertyId: { in: propertyIds } };
      }
    }

    const historicalData = await Promise.all(timeIntervals.map(async (m) => {
      const [bookings, leads] = await Promise.all([
        prisma.booking.count({
          where: {
            createdAt: { gte: m.start, lte: m.end },
            ...finalWhereBase,
            ...finalBookingOwnerFilter
          }
        }),
        prisma.lead.count({
          where: {
            createdAt: { gte: m.start, lte: m.end },
            ...finalWhereBase,
            ...leadOwnerFilter
          }
        })
      ]);
      return { name: m.name, bookings, leads };
    }));

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProperties,
          totalUnits,
          totalBookings,
          activeBookings,
          pendingBookings: pendingBookingsCount,
          completedBookings,
          totalRevenue: totalRevenue._sum.totalPrice || 0,
          totalOwners,
          availableUnits: totalUnits - activeBookings,
          occupiedUnits: activeBookings
        },
        recentBookings,
        topWorkspaces: topWorkspaceDetails || [],
        historicalData,
        periodLabel
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard statistics'
    });
  }
};

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tenantId: queryTenantId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      role,
      status,
      industryType
    } = req.query;

    const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;
    const isAdmin = req.user.role === 2;

    // For system admins, tenantId is optional to see all users across tenants
    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

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
    if (tenantId) where.tenantId = tenantId;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { bookings: true } }
        },
        orderBy: { [sortBy]: sortOrder },
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

// Update user status (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(status !== undefined && { status: parseInt(status) }),
        ...(role !== undefined && { role: parseInt(role) }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
      }
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.review.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
};

// Get property owners (Admin only)
const getPropertyOwners = async (req, res) => {
  try {
    const { tenantId, page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { tenantId, role: 3 };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [owners, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          _count: { select: { userPropertyAccess: true } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where })
    ]);

    const mappedOwners = owners.map(owner => ({
      ...owner,
      _count: {
        properties: owner._count.userPropertyAccess
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        owners: mappedOwners,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get property owners error:', error);
    res.status(500).json({ success: false, message: 'Error fetching owners' });
  }
};

// Get all workspace (Now handles Units, as Space model doesn't exist)
const getAllSpaces = async (req, res) => {
  try {
    const { tenantId: queryTenantId, page = 1, limit = 10, industryType, ownerId } = req.query;
    const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;
    const isAdmin = req.user.role === 2;

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    if (ownerId && isAdmin) {
      where.property = {
        userPropertyAccess: {
          some: { userId: ownerId }
        }
      };
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: { property: { select: { title: true } } },
        skip,
        take: parseInt(limit)
      }),
      prisma.unit.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: { workspace: units, pagination: { total } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching units' });
  }
};

const createSpace = async (req, res) => {
  // Redirect to Property or Unit creation as needed
  res.status(501).json({ success: false, message: 'Endpoint deprecated. Use /properties or /units' });
};

// Get system analytics
const getSystemAnalytics = async (req, res) => {
  try {
    const { tenantId: queryTenantId, period = 'month', industryType } = req.query;
    const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;
    const isAdmin = req.user.role === 2;

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    const [bookingStats, userStats, unitStats] = await Promise.all([
      prisma.booking.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true }
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: { tenantId },
        _count: { id: true }
      }),
      prisma.unit.groupBy({
        by: ['unitCategory'],
        where: { tenantId },
        _count: { id: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: { bookingStats, userStats, unitStats }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Analytics error' });
  }
};

const getAllProperties = async (req, res) => {
  try {
    const { tenantId: queryTenantId, page = 1, limit = 10, search, industryType, ownerId } = req.query;
    const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;
    const isAdmin = req.user.role === 2;

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    if (ownerId && isAdmin) {
      where.userPropertyAccess = {
        some: { userId: ownerId }
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: { _count: { select: { units: true } } },
        skip,
        take: parseInt(limit)
      }),
      prisma.property.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: { properties, pagination: { total } }
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ success: false, message: 'Error fetching properties' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password, name, phone, role, tenantId, status } = req.body;

    if (!email || !password || !name || !tenantId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        phone,
        role: role ? parseInt(role) : 1,
        tenantId,
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
    console.error('Admin createUser error:', error);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  createUser,
  updateUserStatus,
  deleteUser,
  getPropertyOwners,
  getAllSpaces,
  createSpace,
  getSystemAnalytics,
  getAllProperties
};

const { prisma } = require('../config/database');

// Get all workspaces with filters
const getSeats = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      unitCategory,  // Fixed: was type
      city,
      minPrice,
      maxPrice,
      capacity,
      status = 1,    // Fixed: was available
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      status: parseInt(status),  // Fixed: was isAvailable
      tenantId,                 // Added: tenant filtering
      ...(unitCategory && { unitCategory: parseInt(unitCategory) }),  // Fixed: was type
      ...(capacity && { capacity: { gte: parseInt(capacity) } }),
      property: {
        ...(city && { city: { contains: city, mode: 'insensitive' } }),
        status: 1,  // Fixed: was isActive
        tenantId    // Added: tenant filtering
      }
    };

    // Price filtering - would need to join with UnitPricing
    if (minPrice || maxPrice) {
      // This would require a more complex query with UnitPricing
      // For now, basic implementation
    }

    const [workspaces, total] = await Promise.all([
      prisma.unit.findMany({  // Fixed: was seats.findMany
        where,
        include: {
          space: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              photos: {
                where: { isPrimary: true },
                take: 1,
              }
            }
          },
          photos: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: {
            select: {
              reviews: true,
              bookings: {
                where: {
                  status: { in: ['CONFIRMED', 'COMPLETED'] }
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.seats.count({ where })
    ]);

    // Get average rating for each seats
    const workspacesWithRatings = await Promise.all(
      workspaces.map(async (seats) => {
        const avgRating = await prisma.review.aggregate({
          where: { workspaceId: seats.id },
          _avg: { rating: true }
        });

        return {
          ...seats,
          averageRating: avgRating._avg.rating || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        workspaces: workspacesWithRatings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching workspaces'
    });
  }
};

// Get seats by ID
const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;

    const seats = await prisma.seats.findUnique({
      where: { id },
      include: {
        space: {
          include: {
            amenities: {
              include: {
                amenity: true
              }
            },
            operatingHours: {
              orderBy: { dayOfWeek: 'asc' }
            },
            photos: {
              orderBy: { order: 'asc' }
            }
          }
        },
        photos: {
          orderBy: { order: 'asc' }
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            reviews: true,
            bookings: {
              where: {
                status: { in: ['CONFIRMED', 'COMPLETED'] }
              }
            }
          }
        }
      }
    });

    if (!seats) {
      return res.status(404).json({
        success: false,
        message: 'Seats not found'
      });
    }

    // Get average rating
    const avgRating = await prisma.review.aggregate({
      where: { workspaceId: id },
      _avg: { rating: true },
      _count: { rating: true }
    });

    const workspaceWithRating = {
      ...seats,
      averageRating: avgRating._avg.rating || 0,
      totalReviews: avgRating._count.rating,
    };

    res.status(200).json({
      success: true,
      data: { seats: workspaceWithRating }
    });
  } catch (error) {
    console.error('Get seats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching seats'
    });
  }
};

// Create seats (Admin/Owner only)
const createWorkspace = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      capacity,
      area,
      hourlyRate,
      dailyRate,
      monthlyRate,
      features,
      spaceId
    } = req.body;

    // Check if space exists
    const space = await prisma.space.findUnique({
      where: { id: spaceId }
    });

    if (!space) {
      return res.status(404).json({
        success: false,
        message: 'Space not found'
      });
    }

    const seats = await prisma.seats.create({
      data: {
        name,
        description,
        type: type.toUpperCase(),
        capacity,
        area,
        hourlyRate,
        dailyRate,
        monthlyRate,
        features: features || [],
        spaceId,
      },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Seats created successfully',
      data: { seats }
    });
  } catch (error) {
    console.error('Create seats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating seats'
    });
  }
};

// Update seats (Admin/Owner only)
const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Convert type to uppercase if provided
    if (updateData.type) {
      updateData.type = updateData.type.toUpperCase();
    }

    const seats = await prisma.seats.update({
      where: { id },
      data: updateData,
      include: {
        space: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Seats updated successfully',
      data: { seats }
    });
  } catch (error) {
    console.error('Update seats error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Seats not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating seats'
    });
  }
};

// Delete seats (Admin/Owner only)
const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction for ACID compliance
    await prisma.$transaction(async (tx) => {
      // Check if seats has active bookings
      const activeBookings = await tx.booking.count({
        where: {
          workspaceId: id,
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      });

      if (activeBookings > 0) {
        throw new Error('Cannot delete seats with active bookings');
      }

      // Delete related records
      await tx.workspacePhoto.deleteMany({
        where: { workspaceId: id }
      });

      await tx.review.deleteMany({
        where: { workspaceId: id }
      });

      // Delete seats
      await tx.seats.delete({
        where: { id }
      });
    });

    res.status(200).json({
      success: false,
      message: 'Seats deleted successfully'
    });
  } catch (error) {
    console.error('Delete seats error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Seats not found'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting seats'
    });
  }
};

// Get seats availability
const getWorkspaceAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Check seats exists
    const seats = await prisma.seats.findUnique({
      where: { id },
      select: { id: true, name: true, capacity: true }
    });

    if (!seats) {
      return res.status(404).json({
        success: false,
        message: 'Seats not found'
      });
    }

    // Get conflicting bookings
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        workspaceId: id,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) }
          }
        ]
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });

    const isAvailable = conflictingBookings.length === 0;

    res.status(200).json({
      success: true,
      data: {
        seats,
        isAvailable,
        conflictingBookings,
        requestedDates: {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      }
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking availability'
    });
  }
};

module.exports = {
  getSeats,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceAvailability,
};

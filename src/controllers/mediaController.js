const { prisma } = require('../config/database');
const cloudinary = require('../config/cloudinary');

/**
 * Get all media files
 * Filters by tenantId and optionally by type, category, and search query.
 */
const getAllMedia = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ownerId,
      industryType
    } = req.query;

    const tenantId = req.query.tenantId || req.tenant?.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    // Owner logic
    if (ownerId && req.user.role === 2) {
      where.userId = ownerId;
    } else if (req.user.role === 3) {
      // Owners only see their own media
      where.userId = req.user.id;
    }

    if (type) where.type = type.toLowerCase();
    if (category) where.category = category.toLowerCase();

    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        include: {
          user: { // Changed from uploadedByUser to user
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.media.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        media,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching media'
    });
  }
};

/**
 * Get media by ID
 */
const getMediaById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check permissions: Must belong to tenant
    if (tenantId && media.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // If it's a regular user, they can only see their own media?
    // Usually for media library, anyone in the tenant can see it.
    // If we want to restrict owners to their own media:
    // if (req.user.role === 3 && media.userId !== req.user.id) { ... }

    res.status(200).json({
      success: true,
      data: { media }
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching media'
    });
  }
};

/**
 * Create media metadata and handle file upload
 */
const uploadMedia = async (req, res) => {
  try {
    const {
      alt,
      description,
      category
    } = req.body;

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Role-based context override
    let tenantId = req.tenant?.id || req.user?.tenantId;
    let userId = req.user?.id;

    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (req.user.role === 2) { // ADMIN
      if (req.body.tenantId && isUuid(req.body.tenantId)) tenantId = req.body.tenantId;
      if (req.body.ownerId && isUuid(req.body.ownerId)) userId = req.body.ownerId;
    }

    console.log('Final Resolve:', { tenantId, userId, role: req.user.role });

    // Determine type based on mimetype
    let type = 'document';
    if (file.mimetype.startsWith('image/')) type = 'image';
    else if (file.mimetype.startsWith('video/')) type = 'video';
    else if (file.mimetype.startsWith('audio/')) type = 'audio';

    // Upload to Cloudinary using stream
    const uploadToCloudinary = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `realestate/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const cloudinaryResult = await uploadToCloudinary(file.buffer);
    const url = cloudinaryResult.secure_url;

    console.log('Cloudinary Upload Result:', { url, public_id: cloudinaryResult.public_id });

    const media = await prisma.media.create({
      data: {
        filename: cloudinaryResult.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        alt: alt || '',
        description: description || '',
        category: category ? category.toLowerCase() : 'general',
        type,
        tenantId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Media uploaded and created successfully',
      data: { media }
    });
  } catch (error) {
    console.error('Create media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating media'
    });
  }
};

/**
 * Update media metadata
 */
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { alt, description, category, filename } = req.body;
    const tenantId = req.tenant?.id;

    // Check if media exists and belongs to the tenant
    const existingMedia = await prisma.media.findUnique({
      where: { id }
    });

    if (!existingMedia) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    if (tenantId && existingMedia.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Role-based restrictions if any
    if (req.user.role === 3 && existingMedia.userId !== req.user.id) {
      // Optional: Owners can only update their own media
      // return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const media = await prisma.media.update({
      where: { id },
      data: {
        ...(alt !== undefined && { alt }),
        ...(description !== undefined && { description }),
        ...(category && { category: category.toLowerCase() }),
        ...(filename && { filename }),
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Media updated successfully',
      data: { media }
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating media'
    });
  }
};

/**
 * Delete media
 */
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    // Check if media exists and belongs to the tenant
    const existingMedia = await prisma.media.findUnique({
      where: { id }
    });

    if (!existingMedia) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    if (tenantId && existingMedia.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from Cloudinary if it's not a documentation type or if we just want to delete it anyway
    if (existingMedia.filename) {
      try {
        await cloudinary.uploader.destroy(existingMedia.filename);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    await prisma.media.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting media'
    });
  }
};

/**
 * Get media statistics
 */
const getMediaStats = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    const where = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [
      totalMedia,
      totalSize,
      mediaByType,
      mediaByCategory,
      recentUploads
    ] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.aggregate({
        where,
        _sum: { size: true }
      }),
      prisma.media.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
        _sum: { size: true }
      }),
      prisma.media.groupBy({
        by: ['category'],
        where,
        _count: { id: true }
      }),
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          filename: true,
          type: true,
          size: true,
          createdAt: true,
          url: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMedia,
        totalSize: totalSize._sum.size || 0,
        mediaByType,
        mediaByCategory,
        recentUploads
      }
    });
  } catch (error) {
    console.error('Get media stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching media statistics'
    });
  }
};

module.exports = {
  getAllMedia,
  getMediaById,
  uploadMedia,
  updateMedia,
  deleteMedia,
  getMediaStats,
};

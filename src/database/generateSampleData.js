const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function generateSampleData() {
  console.log('🌱 Generating specialized sample data...');

  try {
    // 1. Clean existing data (respecting constraints)
    await prisma.formBuilder.deleteMany();
    await prisma.marketingWorkflow.deleteMany();
    await prisma.campaignLog.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.audienceGroup.deleteMany();
    await prisma.emailTemplate.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.media.deleteMany();
    await prisma.userPropertyAccess.deleteMany();
    await prisma.tenantModule.deleteMany();
    await prisma.widget.deleteMany();
    await prisma.module.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.unitAmenity.deleteMany();
    await prisma.coworkingUnitDetails.deleteMany();
    await prisma.realEstateUnitDetails.deleteMany();
    await prisma.unitPricing.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.property3DConfig.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    console.log('🧹 Database cleaned');

    // 2. Create Tenancies
    const tenantRE = await prisma.tenant.create({
      data: {
        name: 'Elite Real Estate Ltd',
        type: 1, // Real Estate
        domain: 'elite-re.com',
        status: 1
      }
    });

    const tenantCW = await prisma.tenant.create({
      data: {
        name: 'Innovation Coworking Spaces',
        type: 2, // Co-working
        domain: 'innovation-cw.com',
        status: 1
      }
    });

    console.log('🏢 Tenants created: Real Estate and Co-working');

    // 3. Create Modules
    const modules = await Promise.all([
      prisma.module.create({ data: { name: 'Widget Creator', slug: 'widget_creator', status: 1 } }),
      prisma.module.create({ data: { name: 'Marketing Hub', slug: 'marketing_hub', status: 1 } }),
      prisma.module.create({ data: { name: 'Advanced Analytics', slug: 'analytics_pro', status: 1 } }),
      prisma.module.create({ data: { name: '3D Property Viewer', slug: '3d_viewer', status: 1 } }),
      prisma.module.create({ data: { name: 'Discovery Portal', slug: 'discovery', status: 1 } })
    ]);

    // Assign modules to both tenants
    for (const tenant of [tenantRE, tenantCW]) {
      for (const mod of modules) {
        await prisma.tenantModule.create({
          data: { tenantId: tenant.id, moduleId: mod.id, isActive: true }
        });
      }
    }

    // 4. Create Users
    const hashedPassword = await bcrypt.hash('password123', 12);

    // 1 Admin-Role(2)
    const adminUser = await prisma.user.create({
      data: {
        name: 'System Administrator',
        email: 'admin@system.com',
        passwordHash: hashedPassword,
        role: 2,
        tenantId: tenantRE.id,
        status: 1
      }
    });

    // 2 Owner-Role(3)
    const ownerRE = await prisma.user.create({
      data: {
        name: 'Real Estate Owner',
        email: 'owner@elite-re.com',
        passwordHash: hashedPassword,
        role: 3,
        tenantId: tenantRE.id,
        status: 1
      }
    });

    const ownerCW = await prisma.user.create({
      data: {
        name: 'Coworking Owner',
        email: 'owner@innovation-cw.com',
        passwordHash: hashedPassword,
        role: 3,
        tenantId: tenantCW.id,
        status: 1
      }
    });

    // 10 Users-Role(1) (5 per tenant)
    const users = [];
    for (let i = 1; i <= 10; i++) {
      const tenant = i <= 5 ? tenantRE : tenantCW;
      const user = await prisma.user.create({
        data: {
          name: `Sample User ${i}`,
          email: `user${i}@example.com`,
          passwordHash: hashedPassword,
          role: 1,
          tenantId: tenant.id,
          status: 1
        }
      });
      users.push(user);
    }

    console.log('👤 Users created: 1 Admin, 2 Owners, 10 Customers');

    // 5. Amenities
    const amenities = await Promise.all([
      prisma.amenity.create({ data: { name: 'Swimming Pool', category: 1, icon: 'waves' } }),
      prisma.amenity.create({ data: { name: 'High Speed WiFi', category: 2, icon: 'wifi' } }),
      prisma.amenity.create({ data: { name: 'Gym', category: 1, icon: 'dumbbell' } }),
      prisma.amenity.create({ data: { name: 'Parking', category: 1, icon: 'car' } }),
      prisma.amenity.create({ data: { name: 'Coffee Lounge', category: 3, icon: 'cup-hot' } })
    ]);

    // 6. Properties & Units (5 each)
    const reProperties = [];
    const cwProperties = [];
    const reUnits = [];
    const cwUnits = [];

    // Real Estate Properties
    for (let i = 1; i <= 5; i++) {
      const prop = await prisma.property.create({
        data: {
          tenantId: tenantRE.id,
          propertyType: 1, // residential
          title: `Elite Residency Block ${i}`,
          slug: `elite-residency-${i}`,
          description: `Luxury living in Block ${i} with premium finishing.`,
          addressLine1: `${100 + i} Blue Hill Road`,
          city: 'London',
          state: 'Greater London',
          country: 'UK',
          status: 1
        }
      });
      reProperties.push(prop);

      // Assign to Owner
      await prisma.userPropertyAccess.create({
        data: {
          tenantId: tenantRE.id,
          userId: ownerRE.id,
          propertyId: prop.id,
          accessLevel: 3
        }
      });

      // Media for property (2 per prop)
      const pMedia1 = await prisma.media.create({
        data: {
          tenantId: tenantRE.id,
          userId: ownerRE.id,
          filename: `re-prop-${i}-1.jpg`,
          url: `https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800`,
          type: 'image',
          category: 'properties'
        }
      });
      const pMedia2 = await prisma.media.create({
        data: {
          tenantId: tenantRE.id,
          userId: ownerRE.id,
          filename: `re-prop-${i}-2.jpg`,
          url: `https://images.unsplash.com/photo-1600585154340-be6161a46108?q=80&w=800`,
          type: 'image',
          category: 'properties'
        }
      });

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          mainImageId: pMedia1.id,
          gallery: [pMedia1.id, pMedia2.id]
        }
      });

      // 1 Unit per property
      const unit = await prisma.unit.create({
        data: {
          tenantId: tenantRE.id,
          propertyId: prop.id,
          unitCategory: 1, // residential
          unitCode: `APT-${100 + i}`,
          slug: `apt-${100 + i}`,
          floorNo: i,
          capacity: 4,
          sizeSqft: 1200,
          status: 1
        }
      });
      reUnits.push(unit);

      // Real Estate Details
      await prisma.realEstateUnitDetails.create({
        data: {
          unitId: unit.id,
          bedrooms: 2,
          bathrooms: 2,
          furnishing: 3, // fully furnished
          parkingSlots: 1
        }
      });

      // Pricing
      await prisma.unitPricing.create({
        data: {
          unitId: unit.id,
          pricingModel: 4, // monthly
          price: 2500 + (i * 100),
          currency: 'GBP'
        }
      });

      // Media for unit (2 per unit)
      const uMedia1 = await prisma.media.create({
        data: {
          tenantId: tenantRE.id,
          userId: ownerRE.id,
          filename: `re-unit-${i}-1.jpg`,
          url: `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800`,
          type: 'image',
          category: 'units'
        }
      });
      const uMedia2 = await prisma.media.create({
        data: {
          tenantId: tenantRE.id,
          userId: ownerRE.id,
          filename: `re-unit-${i}-2.jpg`,
          url: `https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=800`,
          type: 'image',
          category: 'units'
        }
      });

      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          mainImageId: uMedia1.id,
          gallery: [uMedia1.id, uMedia2.id]
        }
      });

      // 3D Config
      await prisma.property3DConfig.create({
        data: {
          propertyId: prop.id,
          config: { scene: { background: "#fafafa" } },
          layout: [{ id: uuidv4(), unitId: unit.id, type: "apartment", position: { x: 0, y: 0, z: 0 }, dimensions: { w: 10, h: 3, d: 8 }, color: "#e0e0e0" }]
        }
      });
    }

    // Co-working Properties
    for (let i = 1; i <= 5; i++) {
      const prop = await prisma.property.create({
        data: {
          tenantId: tenantCW.id,
          propertyType: 2, // commercial
          title: `Innovation Hub ${i}`,
          slug: `innovation-hub-${i}`,
          description: `Modern workspace for startup ${i} and freelancers.`,
          addressLine1: `${50 * i} Tech Avenue`,
          city: 'Austin',
          state: 'Texas',
          country: 'USA',
          status: 1
        }
      });
      cwProperties.push(prop);

      // Assign to Owner
      await prisma.userPropertyAccess.create({
        data: {
          tenantId: tenantCW.id,
          userId: ownerCW.id,
          propertyId: prop.id,
          accessLevel: 3
        }
      });

      // Media for property (2 per prop)
      const pMedia1 = await prisma.media.create({
        data: {
          tenantId: tenantCW.id,
          userId: ownerCW.id,
          filename: `cw-prop-${i}-1.jpg`,
          url: `https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800`,
          type: 'image',
          category: 'properties'
        }
      });
      const pMedia2 = await prisma.media.create({
        data: {
          tenantId: tenantCW.id,
          userId: ownerCW.id,
          filename: `cw-prop-${i}-2.jpg`,
          url: `https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=800`,
          type: 'image',
          category: 'properties'
        }
      });

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          mainImageId: pMedia1.id,
          gallery: [pMedia1.id, pMedia2.id]
        }
      });

      // 1 Unit per property
      const unit = await prisma.unit.create({
        data: {
          tenantId: tenantCW.id,
          propertyId: prop.id,
          unitCategory: 2, // commercial
          unitCode: `DESK-${100 + i}`,
          slug: `desk-${100 + i}`,
          floorNo: 1,
          capacity: 1,
          sizeSqft: 50,
          status: 1
        }
      });
      cwUnits.push(unit);

      // Coworking Details
      await prisma.coworkingUnitDetails.create({
        data: {
          unitId: unit.id,
          seatType: 1, // desk
          pricingBasis: 2 // per unit
        }
      });

      // Pricing
      await prisma.unitPricing.create({
        data: {
          unitId: unit.id,
          pricingModel: 2, // hourly
          price: 15 + i,
          currency: 'USD'
        }
      });

      // Media for unit (2 per unit)
      const uMedia1 = await prisma.media.create({
        data: {
          tenantId: tenantCW.id,
          userId: ownerCW.id,
          filename: `cw-unit-${i}-1.jpg`,
          url: `https://images.unsplash.com/photo-1431540015161-0bf868a2d407?q=80&w=800`,
          type: 'image',
          category: 'units'
        }
      });
      const uMedia2 = await prisma.media.create({
        data: {
          tenantId: tenantCW.id,
          userId: ownerCW.id,
          filename: `cw-unit-${i}-2.jpg`,
          url: `https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=800`,
          type: 'image',
          category: 'units'
        }
      });

      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          mainImageId: uMedia1.id,
          gallery: [uMedia1.id, uMedia2.id]
        }
      });

      // 3D Config
      await prisma.property3DConfig.create({
        data: {
          propertyId: prop.id,
          config: { scene: { background: "#eceff1" } },
          layout: [{ id: uuidv4(), unitId: unit.id, type: "desk", position: { x: i - 3, y: 0.5, z: 0 }, dimensions: { w: 1, h: 0.8, d: 1 }, color: "#34d399" }]
        }
      });
    }

    console.log('🏘️ Properties and Units created with media and 3D configs');

    // 7. Leads
    for (let i = 0; i < 10; i++) {
      const tenant = i < 5 ? tenantRE : tenantCW;
      const property = i < 5 ? reProperties[i] : cwProperties[i - 5];
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          name: `Lead ${i + 1}`,
          email: `lead${i + 1}@interested.com`,
          phone: `+1555000000${i}`,
          message: "I am looking for a new space starting next month.",
          source: 1, // website
          status: (i % 5) + 1,
          budget: 1000 + (i * 200)
        }
      });
    }

    // 8. Bookings & Payments
    for (let i = 0; i < 5; i++) {
      const tenant = i < 3 ? tenantRE : tenantCW;
      const unit = i < 3 ? reUnits[i] : cwUnits[i - 3];
      const user = i < 3 ? users[i] : users[i + 5];

      const booking = await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          userId: user.id,
          startAt: new Date(),
          endAt: new Date(new Date().getTime() + (7 * 24 * 60 * 60 * 1000)),
          status: 2, // confirmed
          totalPrice: 500,
          paymentStatus: 2 // paid
        }
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          userId: user.id,
          amount: 500,
          status: 'COMPLETED',
          paymentMethod: 'Credit Card',
          transactionId: `txn_${uuidv4().substring(0, 8)}`
        }
      });
    }

    // 9. Widgets
    await prisma.widget.create({
      data: {
        tenantId: tenantRE.id,
        name: 'Elite Property Listing',
        uniqueId: 'elite-listing-widget',
        type: 'listing',
        configuration: { theme: { primaryColor: '#b91c1c' }, display: { layout: 'grid' } },
        status: 1
      }
    });

    await prisma.widget.create({
      data: {
        tenantId: tenantCW.id,
        name: 'Innovation Booking Desk',
        uniqueId: 'innovation-booking-widget',
        type: 'booking',
        configuration: { theme: { primaryColor: '#059669' }, display: { layout: 'list' } },
        status: 1
      }
    });

    // 10. Marketing Data
    const group = await prisma.audienceGroup.create({
      data: {
        tenantId: tenantRE.id,
        name: 'High Value Investors',
        description: 'Leads interested in properties above $1M',
        isDynamic: false
      }
    });

    const template = await prisma.emailTemplate.create({
      data: {
        tenantId: tenantRE.id,
        name: 'Welcome Template',
        subject: 'Welcome to Elite Real Estate',
        content: '<h1>Welcome!</h1><p>Thank you for your interest.</p>',
        type: 'email'
      }
    });

    await prisma.campaign.create({
      data: {
        tenantId: tenantRE.id,
        name: 'Winter Promotion',
        templateId: template.id,
        groupId: group.id,
        status: 1, // Draft
      }
    });

    await prisma.formBuilder.create({
      data: {
        tenantId: tenantRE.id,
        name: 'Contact Us',
        configuration: {
          title: 'Contact Us',
          fields: [
            { id: 'f1', label: 'Name', type: 'text', required: true },
            { id: 'f2', label: 'Email', type: 'email', required: true }
          ]
        },
        status: 1
      }
    });

    console.log('✅ Specialized sample data generation complete!');

  } catch (error) {
    console.error('❌ Error generating sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateSampleData();

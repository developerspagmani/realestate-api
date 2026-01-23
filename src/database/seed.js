const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
  log: ['info', 'query', 'warn', 'error'],
});

async function main() {
  console.log('Starting multi-tenant database seeding...');

  try {
    // Clean existing data in correct order
    await prisma.auditLog.deleteMany();
    await prisma.userPropertyAccess.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.unitAmenity.deleteMany();
    await prisma.coworkingUnitDetails.deleteMany();
    await prisma.realEstateUnitDetails.deleteMany();
    await prisma.unitPricing.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    console.log('🧹 Cleaned existing data');

    // Create tenants
    const tenants = await Promise.all([
      prisma.tenant.create({
        data: {
          name: 'Premium Coworking Spaces',
          type: 2, // Co-working
          domain: 'coworking.example.com',
          status: 1
        }
      }),
      prisma.tenant.create({
        data: {
          name: 'Real Estate Pro',
          type: 1, // Real Estate
          domain: 'realestate.example.com',
          status: 1
        }
      })
    ]);

    console.log(`✅ Created ${tenants.length} tenants`);

    // Create amenities
    const amenities = await Promise.all([
      prisma.amenity.create({
        data: { name: 'High-Speed WiFi', category: 2, icon: 'wifi', status: 1 }
      }),
      prisma.amenity.create({
        data: { name: 'Parking', category: 1, icon: 'car', status: 1 }
      }),
      prisma.amenity.create({
        data: { name: 'Meeting Rooms', category: 1, icon: 'users', status: 1 }
      })
    ]);

    console.log(`✅ Created ${amenities.length} amenities`);

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const users = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenants[0].id,
          name: 'Admin User',
          email: 'admin@coworking.example.com',
          passwordHash: hashedPassword,
          role: 2,
          phone: '+1234567890',
          status: 1
        }
      }),
      prisma.user.create({
        data: {
          tenantId: tenants[1].id,
          name: 'Real Estate Admin',
          email: 'admin@realestate.example.com',
          passwordHash: hashedPassword,
          role: 2,
          phone: '+1234567891',
          status: 1
        }
      })
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create properties
    const properties = await Promise.all([
      prisma.property.create({
        data: {
          tenantId: tenants[0].id,
          propertyType: 2,
          title: 'Downtown Coworking Hub',
          description: 'Modern coworking space',
          addressLine1: '123 Main Street',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          status: 1
        }
      }),
      prisma.property.create({
        data: {
          tenantId: tenants[1].id,
          propertyType: 1,
          title: 'Luxury Apartments',
          description: 'Premium residential apartments',
          addressLine1: '789 Residential Blvd',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90028',
          status: 1
        }
      })
    ]);

    console.log(`✅ Created ${properties.length} properties`);

    // Create units
    const units = await Promise.all([
      prisma.unit.create({
        data: {
          tenantId: tenants[0].id,
          propertyId: properties[0].id,
          unitCategory: 2,
          unitCode: 'COW-001',
          capacity: 1,
          sizeSqft: 40,
          status: 1
        }
      }),
      prisma.unit.create({
        data: {
          tenantId: tenants[1].id,
          propertyId: properties[1].id,
          unitCategory: 1,
          unitCode: 'RES-101',
          capacity: 2,
          sizeSqft: 800,
          status: 1
        }
      })
    ]);

    console.log(`✅ Created ${units.length} units`);

    // Create unit pricing
    const unitPricing = await Promise.all([
      prisma.unitPricing.create({
        data: {
          unitId: units[0].id,
          pricingModel: 2,
          price: 15.00,
          currency: 'USD'
        }
      }),
      prisma.unitPricing.create({
        data: {
          unitId: units[1].id,
          pricingModel: 4,
          price: 2500.00,
          currency: 'USD'
        }
      })
    ]);

    console.log(`✅ Created ${unitPricing.length} unit pricing records`);

    console.log('\n🎉 Multi-tenant database seeding completed successfully!');
    console.log('\n🔑 Test Accounts:');
    console.log('   Co-working Admin: admin@coworking.example.com / password123');
    console.log('   Real Estate Admin: admin@realestate.example.com / password123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

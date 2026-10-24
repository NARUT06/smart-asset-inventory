const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning Existing Database Records ---');
    await prisma.auditLog.deleteMany();
    await prisma.riskHistory.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.custodyTransfer.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.maintenanceTemplate.deleteMany();
    await prisma.location.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    console.log('1. Seeding 10 Users (Excluding ADMIN)...');
    const sharedPasswordHash = await bcrypt.hash('Password123!', 10);

    // 10 مستخدمين يشملون كافة الأدوار المتبقية في الـ Enum
    const userData = [
        {
            fullName: 'Ahmed Mostafa',
            email: 'ahmed.custodian@bua.edu.eg',
            role: 'CUSTODIAN',
            department: 'Faculty of Computing',
        },
        {
            fullName: 'Mona El-Sayed',
            email: 'mona.custodian@bua.edu.eg',
            role: 'CUSTODIAN',
            department: 'Applied Health Sciences',
        },
        {
            fullName: 'Hassan Mahmoud',
            email: 'hassan.custodian@bua.edu.eg',
            role: 'CUSTODIAN',
            department: 'Engineering Labs',
        },
        {
            fullName: 'Sara Ibrahim',
            email: 'sara.tech@bua.edu.eg',
            role: 'TECHNICIAN',
            department: 'Hardware Maintenance Unit',
        },
        {
            fullName: 'Tarek Youssef',
            email: 'tarek.tech@bua.edu.eg',
            role: 'TECHNICIAN',
            department: 'Network & Systems Unit',
        },
        {
            fullName: 'Karim Adel',
            email: 'karim.tech@bua.edu.eg',
            role: 'TECHNICIAN',
            department: 'Biomedical Engineering',
        },
        {
            fullName: 'Nouran Khaled',
            email: 'nouran.procure@bua.edu.eg',
            role: 'PROCUREMENT',
            department: 'Purchasing & Tenders',
        },
        {
            fullName: 'Sherif Fathy',
            email: 'sherif.procure@bua.edu.eg',
            role: 'PROCUREMENT',
            department: 'Vendor Relations',
        },
        {
            fullName: 'Yasmin Samir',
            email: 'yasmin.auditor@bua.edu.eg',
            role: 'AUDITOR',
            department: 'Quality & Compliance',
        },
        {
            fullName: 'Omar Nabil',
            email: 'omar.auditor@bua.edu.eg',
            role: 'AUDITOR',
            department: 'Internal Asset Audit',
        },
    ];

    const createdUsers = [];
    for (const u of userData) {
        const user = await prisma.user.create({
            data: {
                ...u,
                passwordHash: sharedPasswordHash,
                passwordChangedAt: new Date(),
            },
        });
        createdUsers.push(user);
    }

    const custodians = createdUsers.filter((u) => u.role === 'CUSTODIAN');
    const technicians = createdUsers.filter((u) => u.role === 'TECHNICIAN');
    const generalUsers = createdUsers;

    console.log('2. Seeding 11 Electronic Categories...');
    const categoryDefs = [
        {
            name: 'High-Performance Workstations',
            expectedLifetimeMonths: 48,
            description:
                'Tower workstations for CAD, simulation, and deep learning',
        },
        {
            name: 'Engineering & Faculty Laptops',
            expectedLifetimeMonths: 36,
            description:
                'Laptops assigned to professors, TAs, and technical teams',
        },
        {
            name: 'Rack & Blade Servers',
            expectedLifetimeMonths: 60,
            description:
                'Central compute, virtualization nodes, and storage controllers',
        },
        {
            name: 'Enterprise Routers & Firewalls',
            expectedLifetimeMonths: 72,
            description:
                'Core routing equipment, edge security gateways, and switches',
        },
        {
            name: 'Interactive Smart Displays',
            expectedLifetimeMonths: 60,
            description:
                'Touchscreen displays and interactive boards for lecture halls',
        },
        {
            name: '4K Lab Digital Projectors',
            expectedLifetimeMonths: 48,
            description:
                'High-lumen optical projection systems for classrooms and labs',
        },
        {
            name: 'Digital Storage Oscilloscopes',
            expectedLifetimeMonths: 96,
            description:
                'Electronics, signal processing, and telecommunication lab scopes',
        },
        {
            name: 'Patient Vitals & Rehab Monitors',
            expectedLifetimeMonths: 84,
            description:
                'Biomedical monitors for physical therapy and physiological testing',
        },
        {
            name: 'Multifunction Laser Printers',
            expectedLifetimeMonths: 48,
            description:
                'Networked departmental laser printers and scanning units',
        },
        {
            name: 'Managed PoE Access Switches',
            expectedLifetimeMonths: 72,
            description: 'Access layer Power-over-Ethernet network switches',
        },
        {
            name: 'Precision DC Lab Power Supplies',
            expectedLifetimeMonths: 108,
            description:
                'Benchtop variable power supplies for circuits laboratories',
        },
    ];

    const categories = [];
    for (const c of categoryDefs) {
        const cat = await prisma.category.create({ data: c });
        categories.push(cat);

        // إضافة Template صيانة لكل تصنيف
        await prisma.maintenanceTemplate.create({
            data: {
                title: `Standard Periodic Inspection - ${cat.name}`,
                description: `Scheduled preventive maintenance and sensor calibration protocol for ${cat.name}.`,
                triggerType: 'CALENDAR',
                intervalDays: 90,
                checklist: [
                    {
                        task: 'Clean interior fans and thermal heatsinks',
                        isDone: false,
                    },
                    {
                        task: 'Inspect voltage stability and safety grounding',
                        isDone: false,
                    },
                    { task: 'Run diagnostic firmware test', isDone: false },
                ],
                categoryId: cat.id,
            },
        });
    }

    console.log(
        '3. Seeding BUA Campus, 2 Buildings, 3 Floors, Labs & TA Offices...',
    );
    // CAMPUS
    const campus = await prisma.location.create({
        data: {
            name: 'BUA Main Campus',
            code: 'BUA-MAIN',
            type: 'CAMPUS',
        },
    });

    const buildingNames = [
        { name: 'Engineering & Computing Building', code: 'BUA-ENG' },
        { name: 'Applied Health & Medical Building', code: 'BUA-MED' },
    ];

    const assignableLocations = [];

    for (const bld of buildingNames) {
        const building = await prisma.location.create({
            data: {
                name: bld.name,
                code: bld.code,
                type: 'BUILDING',
                parentId: campus.id,
            },
        });

        for (let f = 1; f <= 3; f++) {
            const floor = await prisma.location.create({
                data: {
                    name: `${bld.name} - Floor ${f}`,
                    code: `${bld.code}-FL0${f}`,
                    type: 'FLOOR',
                    parentId: building.id,
                },
            });

            if (f === 1 || f === 2) {
                // 6 معامل في كل دور
                for (let l = 1; l <= 6; l++) {
                    const lab = await prisma.location.create({
                        data: {
                            name: `Lab ${f}0${l} - ${bld.code === 'BUA-ENG' ? 'Robotics & Computing' : 'Physiotherapy & Rehab'}`,
                            code: `${floor.code}-LAB${f}0${l}`,
                            type: 'LAB',
                            parentId: floor.id,
                        },
                    });
                    assignableLocations.push(lab);
                }
            } else {
                // الدور الثالث: مكاتب لمعيدي الأقسام (Teaching Assistants Offices)
                for (let o = 1; o <= 6; o++) {
                    const office = await prisma.location.create({
                        data: {
                            name: `TA Office ${f}0${o} - Department Staff`,
                            code: `${floor.code}-OFF${f}0${o}`,
                            type: 'OFFICE',
                            parentId: floor.id,
                        },
                    });
                    assignableLocations.push(office);
                }
            }
        }
    }

    console.log('4. Generating 3,000 Electronic Assets...');
    const TOTAL_ASSETS = 3000;
    const brandList = [
        'Dell',
        'HP',
        'Cisco',
        'Keysight',
        'Tektronix',
        'Samsung',
        'Epson',
        'Philips',
        'LG',
        'Siemens',
    ];
    const assetRows = [];

    for (let i = 1; i <= TOTAL_ASSETS; i++) {
        const cat = faker.helpers.arrayElement(categories);
        const loc = faker.helpers.arrayElement(assignableLocations);
        const cust = faker.helpers.arrayElement(custodians);
        const brand = faker.helpers.arrayElement(brandList);

        const purchaseDate = faker.date.past({ years: 3 });
        const warrantyExpiry = faker.date.future({
            years: 2,
            refDate: purchaseDate,
        });
        const cond = faker.helpers.arrayElement([
            'NEW',
            'GOOD',
            'GOOD',
            'FAIR',
            'POOR',
        ]);
        const stat = faker.helpers.arrayElement([
            'IN_USE',
            'IN_USE',
            'IN_USE',
            'IN_STORAGE',
            'UNDER_MAINTENANCE',
        ]);
        const risk = faker.number.float({ min: 5, max: 92, fractionDigits: 2 });
        const isHighRisk = risk > 70;

        assetRows.push({
            assetTag: `BUA-${String(i).padStart(6, '0')}`,
            serialNumber: `SN-${faker.string.alphanumeric({ length: 12 }).toUpperCase()}`,
            name: `${brand} ${cat.name.split(' ')[0]} Pro ${faker.number.int({ min: 200, max: 900 })}`,
            brand,
            model: `MOD-${faker.string.alphanumeric({ length: 6 }).toUpperCase()}`,
            specifications: {
                processor: 'Intel Core i7 / Xeon Hexa-Core',
                ram: '32GB DDR4',
                storage: '1TB NVMe SSD',
                powerSupply: '650W Gold Rated',
            },
            categoryId: cat.id,
            locationId: loc.id,
            custodianId: stat === 'IN_STORAGE' ? null : cust.id,
            condition: cond,
            status: stat,
            riskScore: risk,
            riskLevel:
                risk > 80
                    ? 'CRITICAL'
                    : risk > 60
                      ? 'HIGH'
                      : risk > 30
                        ? 'MEDIUM'
                        : 'LOW',
            failurePredicted: isHighRisk,
            supplierName: faker.helpers.arrayElement([
                'Alpha Informatics Egypt',
                'Delta MedTech Supplies',
                'Cairo Hardware Hub',
                'Global Tech Tenders',
            ]),
            purchaseOrderNumber: `PO-${faker.number.int({ min: 10000, max: 99999 })}`,
            invoiceNumber: `INV-${faker.number.int({ min: 100000, max: 999999 })}`,
            purchaseCost: faker.number.float({
                min: 450,
                max: 8500,
                fractionDigits: 2,
            }),
            purchaseDate,
            warrantyExpiry,
            warrantyTerms: '3 Years Full Hardware On-Site Replacement Support',
        });
    }

    // تقسيم الإدخال لـ Chunks لضمان السرعة مع Neon
    const chunkSize = 500;
    for (let i = 0; i < assetRows.length; i += chunkSize) {
        const chunk = assetRows.slice(i, i + chunkSize);
        await prisma.asset.createMany({ data: chunk });
    }

    console.log(
        '5. Seeding Custody Transfers, Work Orders & Risk Histories...',
    );
    const sampleAssets = await prisma.asset.findMany({
        take: 600,
        select: {
            id: true,
            assetTag: true,
            locationId: true,
            custodianId: true,
        },
    });

    // 1. Custody Transfers
    const transferRows = [];
    for (const a of sampleAssets.slice(0, 300)) {
        const toLoc = faker.helpers.arrayElement(assignableLocations);
        const toCust = faker.helpers.arrayElement(custodians);
        const actor = faker.helpers.arrayElement(generalUsers);

        transferRows.push({
            assetId: a.id,
            fromLocationId: a.locationId,
            toLocationId: toLoc.id,
            fromCustodianId: a.custodianId,
            toCustodianId: toCust.id,
            transferredBy: actor.id,
            reason: faker.helpers.arrayElement([
                'Reallocated for new semester practical sessions',
                'Transferred to specialized TA research room',
                'Moved for annual department lab upgrade',
                'Routine equipment rotation',
            ]),
            createdAt: faker.date.recent({ days: 60 }),
        });
    }
    await prisma.custodyTransfer.createMany({ data: transferRows });

    // 2. Work Orders
    const workOrderRows = [];
    for (const a of sampleAssets.slice(200, 600)) {
        const tech = faker.helpers.arrayElement(technicians);
        const creator = faker.helpers.arrayElement(generalUsers);
        const isDone = faker.datatype.boolean();

        workOrderRows.push({
            assetId: a.id,
            technicianId: tech.id,
            createdBy: creator.id,
            type: faker.helpers.arrayElement(['CORRECTIVE', 'SCHEDULED']),
            title: `Maintenance Routine for ${a.assetTag}`,
            description: faker.helpers.arrayElement([
                'Periodic thermal recalibration and electrical safety check.',
                'Reported intermittent power disruption during lab session.',
                'Firmware upgrade and network link verification.',
            ]),
            priority: faker.helpers.arrayElement([
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL',
            ]),
            status: isDone
                ? 'COMPLETED'
                : faker.helpers.arrayElement([
                      'OPEN',
                      'IN_PROGRESS',
                      'ON_HOLD',
                  ]),
            partsCost: isDone
                ? faker.number.float({ min: 15, max: 450, fractionDigits: 2 })
                : 0,
            downtimeHours: isDone ? faker.number.int({ min: 2, max: 36 }) : 0,
            scheduledDate: faker.date.recent({ days: 30 }),
            completedAt: isDone ? faker.date.recent({ days: 5 }) : null,
            checklist: [
                { task: 'Check capacitor integrity', isDone: true },
                {
                    task: 'Verify operating system and driver logs',
                    isDone: isDone,
                },
            ],
        });
    }
    await prisma.workOrder.createMany({ data: workOrderRows });

    // 3. Risk History
    const riskRows = [];
    for (const a of sampleAssets.slice(0, 200)) {
        const score = faker.number.float({
            min: 10,
            max: 95,
            fractionDigits: 2,
        });
        riskRows.push({
            assetId: a.id,
            riskScore: score,
            riskLevel:
                score > 80
                    ? 'CRITICAL'
                    : score > 60
                      ? 'HIGH'
                      : score > 30
                        ? 'MEDIUM'
                        : 'LOW',
            failurePredicted: score > 70,
            recommendations:
                score > 70
                    ? 'Immediate component maintenance and calibration required'
                    : 'Optimal working condition',
            factors: {
                ambientTemperature: '24C',
                loadCycles: faker.number.int({ min: 100, max: 5000 }),
                runtimeHours: faker.number.int({ min: 500, max: 12000 }),
            },
            assessedAt: faker.date.recent({ days: 45 }),
        });
    }
    await prisma.riskHistory.createMany({ data: riskRows });

    console.log('----------------------------------------------------');
    console.log('✅ BUA DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log(`- Campus: 1 (BUA Main Campus)`);
    console.log(`- Buildings: 2 (Engineering & Medical)`);
    console.log(`- Floors: 6 (3 per building)`);
    console.log(
        `- Labs & Offices: ${assignableLocations.length} locations (6 labs on floors 1-2, 6 TA offices on floor 3)`,
    );
    console.log(
        `- Categories: ${categories.length} (Electronic & High-Tech Devices)`,
    );
    console.log(
        `- Users: ${createdUsers.length} (No ADMINs, password: Password123!)`,
    );
    console.log(`- Assets: ${TOTAL_ASSETS} items`);
    console.log(`- Custody Transfers: ${transferRows.length} logs`);
    console.log(`- Work Orders: ${workOrderRows.length} tickets`);
    console.log('----------------------------------------------------');
}

main()
    .catch((e) => {
        console.error('Seeding Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

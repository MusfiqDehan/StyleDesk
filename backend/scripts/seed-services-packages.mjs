import seedScope from './seed-scope.cjs'
/**
 * Wipe/seed local services, packages, and employees for salon catalog + staff.
 * Package `features` are descriptive (what the package includes).
 * Booking pricing treats selected services and packages as independent line items.
 * Usage: node scripts/seed-services-packages.mjs
 *        npm run seed:catalog
 */
import pg from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL

/** @type {Array<{name:string,category:string,price:number,duration:number,description:string}>} */
const SERVICES = [
  {
    name: 'Hair Cut & Blow Dry',
    category: 'Hair',
    price: 800,
    duration: 45,
    description: 'Precision cut with wash and professional blow dry.',
  },
  {
    name: 'Hair Spa Treatment',
    category: 'Hair',
    price: 1500,
    duration: 60,
    description: 'Deep conditioning spa to restore soft, shiny hair.',
  },
  {
    name: 'Global Hair Color',
    category: 'Hair',
    price: 3500,
    duration: 120,
    description: 'Full-head professional color with conditioning finish.',
  },
  {
    name: 'Keratin Smoothening',
    category: 'Hair',
    price: 8000,
    duration: 180,
    description: 'Frizz-control keratin treatment for sleek, manageable hair.',
  },
  {
    name: 'Classic Facial',
    category: 'Skin',
    price: 1200,
    duration: 45,
    description: 'Cleansing, exfoliation, massage, and glow mask.',
  },
  {
    name: 'Brightening Facial',
    category: 'Skin',
    price: 1800,
    duration: 60,
    description: 'Vitamin-rich facial for dull, uneven skin tone.',
  },
  {
    name: 'Hydra Facial',
    category: 'Skin',
    price: 4500,
    duration: 75,
    description: 'Deep cleanse and hydration for plump, radiant skin.',
  },
  {
    name: 'Cleanup',
    category: 'Skin',
    price: 900,
    duration: 40,
    description: 'Quick deep-clean facial for fresh, clear skin.',
  },
  {
    name: 'Party Makeup',
    category: 'Makeup',
    price: 2500,
    duration: 60,
    description: 'Camera-ready soft glam for parties and events.',
  },
  {
    name: 'Engagement Makeup',
    category: 'Makeup',
    price: 4500,
    duration: 90,
    description: 'Elegant engagement look with lasting finish.',
  },
  {
    name: 'Bridal Makeup',
    category: 'Makeup',
    price: 12000,
    duration: 150,
    description: 'Full bridal makeup with HD finish and touch-up support.',
  },
  {
    name: 'Soft Glam Makeup',
    category: 'Makeup',
    price: 3000,
    duration: 70,
    description: 'Natural soft glam for daytime events and shoots.',
  },
  {
    name: 'Manicure',
    category: 'Nails',
    price: 700,
    duration: 40,
    description: 'Nail shaping, cuticle care, and polish.',
  },
  {
    name: 'Pedicure',
    category: 'Nails',
    price: 900,
    duration: 50,
    description: 'Foot soak, scrub, cuticle care, and polish.',
  },
  {
    name: 'Gel Nail Art',
    category: 'Nails',
    price: 1800,
    duration: 75,
    description: 'Long-wear gel polish with custom nail art.',
  },
  {
    name: 'Head Massage',
    category: 'Spa',
    price: 600,
    duration: 30,
    description: 'Relaxing scalp and head massage with oil.',
  },
  {
    name: 'Full Body Massage',
    category: 'Spa',
    price: 2500,
    duration: 60,
    description: 'Full-body relaxation massage to ease tension.',
  },
  {
    name: 'Foot Spa',
    category: 'Spa',
    price: 1000,
    duration: 40,
    description: 'Soothing foot spa with scrub and massage.',
  },
  {
    name: 'Bridal Mehendi',
    category: 'Bridal',
    price: 3500,
    duration: 120,
    description: 'Intricate bridal mehendi for hands and feet.',
  },
  {
    name: 'Pre-Bridal Glow Facial',
    category: 'Bridal',
    price: 2200,
    duration: 60,
    description: 'Bridal prep facial for luminous wedding-day skin.',
  },
]

/**
 * Features must use exact service names so package+service bookings
 * do not double-charge included services.
 *
 * @type {Array<{category:string,title:string,price:number,billingCycle:string,description:string,features:string[],position:number,popular:boolean}>}
 */
const PACKAGES = [
  {
    category: 'BRIDAL',
    title: 'Bridal Glow Package',
    price: 24999,
    billingCycle: 'package',
    description:
      'Complete bridal beauty package for your big day — makeup, hair, and skin glow.',
    features: [
      'Bridal Makeup',
      'Hair Cut & Blow Dry',
      'Pre-Bridal Glow Facial',
      'Head Massage',
      'Manicure',
    ],
    position: 1,
    popular: true,
  },
  {
    category: 'BRIDAL',
    title: 'Engagement Glam Package',
    price: 14999,
    billingCycle: 'package',
    description: 'Polished engagement look with makeup, hair, and soft glam finishing.',
    features: [
      'Engagement Makeup',
      'Hair Cut & Blow Dry',
      'Brightening Facial',
      'Pedicure',
    ],
    position: 2,
    popular: false,
  },
  {
    category: 'PARTY',
    title: 'Party Ready Package',
    price: 5999,
    billingCycle: 'package',
    description: 'Quick glam package for birthdays, receptions, and evening events.',
    features: ['Party Makeup', 'Hair Cut & Blow Dry', 'Cleanup', 'Manicure'],
    position: 3,
    popular: true,
  },
  {
    category: 'SKIN',
    title: 'Skin Radiance Package',
    price: 7999,
    billingCycle: 'package',
    description: 'Multi-step skin care package for clearer, brighter complexion.',
    features: ['Classic Facial', 'Brightening Facial', 'Cleanup', 'Hydra Facial'],
    position: 4,
    popular: false,
  },
  {
    category: 'HAIR',
    title: 'Hair Revive Package',
    price: 9999,
    billingCycle: 'package',
    description: 'Restore shine and strength with spa, cut, and finishing treatment.',
    features: [
      'Hair Cut & Blow Dry',
      'Hair Spa Treatment',
      'Global Hair Color',
      'Head Massage',
    ],
    position: 5,
    popular: false,
  },
  {
    category: 'SIGNATURE',
    title: 'Signature StyleDesk Package',
    price: 12999,
    billingCycle: 'package',
    description: 'Full StyleDesk — skin, hair, and makeup for a complete transformation.',
    features: [
      'Brightening Facial',
      'Hair Cut & Blow Dry',
      'Soft Glam Makeup',
      'Manicure',
      'Head Massage',
    ],
    position: 6,
    popular: true,
  },
]

/**
 * Staff shown in booking / admin. Phones are unique BD numbers for local use.
 * @type {Array<{name:string,role:string,phone:string,email:string,salary:number,shift:string,experience:number,joinDate:string,employmentType:string,specializations:string[],about:string}>}
 */
const EMPLOYEES = [
  {
    name: 'Nasreen Begum',
    role: 'Stylist',
    phone: '01710001001',
    email: 'nasreen@StyleDesk.local',
    salary: 25000,
    shift: 'morning',
    experience: 8,
    joinDate: '2020-03-15',
    employmentType: 'FULL_TIME',
    specializations: ['Hair', 'Bridal Makeup', 'Coloring'],
    about: 'Senior stylist specializing in bridal and hair color.',
  },
  {
    name: 'Farhana Islam',
    role: 'Stylist',
    phone: '01710001002',
    email: 'farhana@StyleDesk.local',
    salary: 22000,
    shift: 'evening',
    experience: 5,
    joinDate: '2021-06-01',
    employmentType: 'FULL_TIME',
    specializations: ['Makeup', 'Soft Glam', 'Party Looks'],
    about: 'Makeup artist focused on HD and soft glam looks.',
  },
  {
    name: 'Sadia Rahman',
    role: 'Stylist',
    phone: '01710001003',
    email: 'sadia@StyleDesk.local',
    salary: 20000,
    shift: 'morning',
    experience: 4,
    joinDate: '2022-01-10',
    employmentType: 'FULL_TIME',
    specializations: ['Skin', 'Facial', 'Spa'],
    about: 'Skin and spa specialist for facials and treatments.',
  },
  {
    name: 'Tahmina Akter',
    role: 'Assistant',
    phone: '01710001004',
    email: 'tahmina@StyleDesk.local',
    salary: 12000,
    shift: 'morning',
    experience: 2,
    joinDate: '2023-08-20',
    employmentType: 'FULL_TIME',
    specializations: ['Nails', 'Mehendi'],
    about: 'Assistant stylist for nails and bridal mehendi.',
  },
  {
    name: 'Ruma Chowdhury',
    role: 'Receptionist',
    phone: '01710001005',
    email: 'ruma@StyleDesk.local',
    salary: 15000,
    shift: 'morning',
    experience: 3,
    joinDate: '2022-11-01',
    employmentType: 'FULL_TIME',
    specializations: ['Front Desk'],
    about: 'Front desk and client coordination.',
  },
  {
    name: 'Ayesha Siddique',
    role: 'Manager',
    phone: '01710001006',
    email: 'ayesha@StyleDesk.local',
    salary: 35000,
    shift: 'morning',
    experience: 10,
    joinDate: '2019-05-01',
    employmentType: 'FULL_TIME',
    specializations: ['Operations', 'Training'],
    about: 'Salon manager overseeing floor and staff.',
  },
  {
    name: 'Mehzabin Khan',
    role: 'Stylist',
    phone: '01710001007',
    email: 'mehzabin@StyleDesk.local',
    salary: 18000,
    shift: 'evening',
    experience: 3,
    joinDate: '2023-02-14',
    employmentType: 'PART_TIME',
    specializations: ['Hair Cut', 'Blow Dry', 'Keratin'],
    about: 'Part-time hair stylist for cuts and treatments.',
  },
  {
    name: 'Nusrat Jahan',
    role: 'Stylist',
    phone: '01710001008',
    email: 'nusrat@StyleDesk.local',
    salary: 21000,
    shift: 'morning',
    experience: 6,
    joinDate: '2021-09-12',
    employmentType: 'FULL_TIME',
    specializations: ['Bridal', 'Engagement Makeup', 'Draping'],
    about: 'Bridal specialist for engagement and wedding looks.',
  },
]

const client = new pg.Client({ connectionString: DATABASE_URL })

await client.connect()
console.log('Connected to', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))

await client.query('BEGIN')
try {
  const { tenantId, branchId } = await seedScope(client)
  const beforeSvc = await client.query('SELECT COUNT(*)::int AS n FROM service')
  const beforePkg = await client.query('SELECT COUNT(*)::int AS n FROM style_desk_package')
  const beforeEmp = await client.query('SELECT COUNT(*)::int AS n FROM employee')
  console.log(
    `Removing ${beforeSvc.rows[0].n} services, ${beforePkg.rows[0].n} packages, reseeding ${EMPLOYEES.length} employees (had ${beforeEmp.rows[0].n})…`,
  )

  await client.query('DELETE FROM service WHERE tenant_id=$1', [tenantId])
  await client.query('DELETE FROM style_desk_package WHERE tenant_id=$1', [tenantId])

  // Clear seed staff phones only — avoids wiping auth-linked employees with other numbers
  const seedPhones = EMPLOYEES.map((e) => e.phone)
  await client.query('DELETE FROM employee WHERE phone = ANY($1::text[]) AND tenant_id=$2 AND branch_id=$3', [seedPhones, tenantId, branchId])

  for (const s of SERVICES) {
    await client.query(
      `INSERT INTO service
        (id, name, category, price, duration, status, description, commission, "imageUrl", "bookingCount", "createdAt", "updatedAt")
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, 'active', $5, 0, NULL, 0, NOW(), NOW())`,
      [s.name, s.category, s.price, s.duration, s.description],
    )
  }

  for (const p of PACKAGES) {
    // TypeORM simple-array stores as comma-separated string
    const features = p.features.join(',')
    await client.query(
      `INSERT INTO style_desk_package
        (id, category, title, price, "billingCycle", description, features, position, popular, "imageUrl", "bookingCount", "createdAt", "updatedAt")
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NULL, 0, NOW(), NOW())`,
      [
        p.category,
        p.title,
        p.price,
        p.billingCycle,
        p.description,
        features,
        p.position,
        p.popular,
      ],
    )
  }

  for (const e of EMPLOYEES) {
    const specializations = e.specializations.join(',')
    await client.query(
      `INSERT INTO employee
        (id, name, role, "customRole", phone, email, salary, commission, shift, experience, "joinDate",
         status, "employmentType", "fingerprintCode", specializations, image, about, "createdAt", "updatedAt")
       VALUES
        (gen_random_uuid(), $1, $2::employee_role_enum, NULL, $3, $4, $5, 0, $6, $7, $8::date,
         'ACTIVE'::employee_status_enum, $9::employee_employmenttype_enum, NULL, $10, NULL, $11, NOW(), NOW())`,
      [
        e.name,
        e.role,
        e.phone,
        e.email,
        e.salary,
        e.shift,
        e.experience,
        e.joinDate,
        e.employmentType,
        specializations,
        e.about,
      ],
    )
  }


  const services = await client.query(
    'SELECT name, category, price, commission FROM service ORDER BY category, name',
  )
  const packages = await client.query(
    'SELECT title, category, price, popular, features FROM style_desk_package ORDER BY position',
  )
  const employees = await client.query(
    'SELECT name, role, phone, salary, shift FROM employee WHERE phone = ANY($1::text[]) ORDER BY name',
    [seedPhones],
  )
  console.log(`\nSeeded ${services.rows.length} services (commission=0):`)
  for (const row of services.rows) {
    console.log(`  [${row.category}] ${row.name} — ৳${row.price}`)
  }
  console.log(`\nSeeded ${packages.rows.length} packages:`)
  for (const row of packages.rows) {
    console.log(
      `  [${row.category}] ${row.title} — ৳${row.price}${row.popular ? ' ★' : ''}`,
    )
    console.log(`    features: ${row.features}`)
  }
  console.log(`\nSeeded ${employees.rows.length} employees:`)
  for (const row of employees.rows) {
    console.log(
      `  [${row.role}] ${row.name} — ${row.phone} · ৳${row.salary} · ${row.shift}`,
    )
  }
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed, rolled back:', err)
  process.exitCode = 1
} finally {
  await client.end()
}

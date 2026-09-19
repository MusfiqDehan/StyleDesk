import seedScope from './seed-scope.cjs'
/**
 * Seed salon inventory products for /admin/inventory.
 *
 * Usage:
 *   node scripts/seed-inventory.mjs
 *   npm run seed:inventory
 *
 * Options:
 *   --force   Wipe existing inventory rows before inserting (default when empty)
 *
 * Env:
 *   DATABASE_URL  (default: postgresql://postgres:postgres@localhost:5433/StyleDesk)
 */
import pg from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL
const FORCE = process.argv.includes('--force')

/** @type {Array<{name:string,category:string,stockQty:number,minStockLevel:number,unitPrice:number,supplier:string,expiryDate:string}>} */
const ITEMS = [
  {
    name: 'Loreal Hair Dye - Black',
    category: 'Hair Products',
    stockQty: 40,
    minStockLevel: 10,
    unitPrice: 850,
    supplier: 'Loreal Bangladesh Ltd.',
    expiryDate: '2027-06-30',
  },
  {
    name: 'Loreal Hair Dye - Brown',
    category: 'Hair Products',
    stockQty: 35,
    minStockLevel: 10,
    unitPrice: 850,
    supplier: 'Loreal Bangladesh Ltd.',
    expiryDate: '2027-06-30',
  },
  {
    name: 'Keratin Treatment Cream',
    category: 'Hair Products',
    stockQty: 18,
    minStockLevel: 5,
    unitPrice: 2200,
    supplier: 'Beauty Supply BD',
    expiryDate: '2027-12-31',
  },
  {
    name: 'Argan Hair Oil 100ml',
    category: 'Hair Products',
    stockQty: 50,
    minStockLevel: 15,
    unitPrice: 450,
    supplier: 'Beauty Supply BD',
    expiryDate: '2028-03-15',
  },
  {
    name: 'Professional Shampoo 1L',
    category: 'Hair Products',
    stockQty: 25,
    minStockLevel: 8,
    unitPrice: 1200,
    supplier: 'Matrix Distributors',
    expiryDate: '2027-09-01',
  },
  {
    name: 'Conditioner 1L',
    category: 'Hair Products',
    stockQty: 22,
    minStockLevel: 8,
    unitPrice: 1100,
    supplier: 'Matrix Distributors',
    expiryDate: '2027-09-01',
  },
  {
    name: 'Vitamin C Face Serum',
    category: 'Skin Products',
    stockQty: 30,
    minStockLevel: 8,
    unitPrice: 950,
    supplier: 'Derma Care BD',
    expiryDate: '2027-04-20',
  },
  {
    name: 'Hydrating Face Mask',
    category: 'Skin Products',
    stockQty: 40,
    minStockLevel: 12,
    unitPrice: 180,
    supplier: 'Derma Care BD',
    expiryDate: '2027-08-10',
  },
  {
    name: 'Brightening Facial Cream',
    category: 'Skin Products',
    stockQty: 20,
    minStockLevel: 6,
    unitPrice: 1400,
    supplier: 'Derma Care BD',
    expiryDate: '2027-11-30',
  },
  {
    name: 'Makeup Remover Wipes',
    category: 'Skin Products',
    stockQty: 60,
    minStockLevel: 20,
    unitPrice: 220,
    supplier: 'Salon Essentials',
    expiryDate: '2028-01-15',
  },
  {
    name: 'Nail Polish Remover 250ml',
    category: 'Nail Products',
    stockQty: 28,
    minStockLevel: 8,
    unitPrice: 320,
    supplier: 'Nail Pro BD',
    expiryDate: '2028-06-01',
  },
  {
    name: 'Gel Base Coat',
    category: 'Nail Products',
    stockQty: 15,
    minStockLevel: 5,
    unitPrice: 650,
    supplier: 'Nail Pro BD',
    expiryDate: '2027-10-15',
  },
  {
    name: 'Gel Top Coat',
    category: 'Nail Products',
    stockQty: 15,
    minStockLevel: 5,
    unitPrice: 650,
    supplier: 'Nail Pro BD',
    expiryDate: '2027-10-15',
  },
  {
    name: 'Acrylic Nail Powder',
    category: 'Nail Products',
    stockQty: 12,
    minStockLevel: 4,
    unitPrice: 980,
    supplier: 'Nail Pro BD',
    expiryDate: '2028-02-28',
  },
  {
    name: 'Disposable Razor Pack (50)',
    category: 'Grooming',
    stockQty: 8,
    minStockLevel: 3,
    unitPrice: 750,
    supplier: 'Salon Essentials',
    expiryDate: '2029-01-01',
  },
  {
    name: 'Cotton Pads (200 pcs)',
    category: 'Grooming',
    stockQty: 35,
    minStockLevel: 10,
    unitPrice: 280,
    supplier: 'Salon Essentials',
    expiryDate: '2029-06-01',
  },
  {
    name: 'Disposable Capes (100 pcs)',
    category: 'Grooming',
    stockQty: 10,
    minStockLevel: 3,
    unitPrice: 900,
    supplier: 'Salon Essentials',
    expiryDate: '2029-12-31',
  },
  {
    name: 'Hair Dryer Filter Pack',
    category: 'Equipment',
    stockQty: 6,
    minStockLevel: 2,
    unitPrice: 450,
    supplier: 'Pro Tools BD',
    expiryDate: '2030-01-01',
  },
  {
    name: 'Salon Towels (Dozen)',
    category: 'Equipment',
    stockQty: 14,
    minStockLevel: 4,
    unitPrice: 1600,
    supplier: 'Pro Tools BD',
    expiryDate: '2030-01-01',
  },
  {
    name: 'Sterilization Solution 1L',
    category: 'Equipment',
    stockQty: 9,
    minStockLevel: 3,
    unitPrice: 720,
    supplier: 'Pro Tools BD',
    expiryDate: '2027-07-31',
  },
]

const client = new pg.Client({ connectionString: DATABASE_URL })

await client.connect()
console.log('Connected to', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))

await client.query('BEGIN')
try {
  const { tenantId, branchId } = await seedScope(client)
  const before = await client.query('SELECT COUNT(*)::int AS n FROM inventory')
  const count = before.rows[0].n

  if (count > 0 && !FORCE) {
    console.log(
      `Inventory already has ${count} item(s). Re-run with --force to wipe and reseed.`,
    )
    await client.query('ROLLBACK')
    await client.end()
    process.exit(0)
  }

  if (count > 0 && FORCE) {
    console.log(`Wiping ${count} existing inventory item(s)…`)
    await client.query('DELETE FROM inventory WHERE tenant_id=$1 AND branch_id=$2', [tenantId, branchId])
  }

  for (const item of ITEMS) {
    await client.query(
      `INSERT INTO inventory
        (id, name, category, "stockQty", "minStockLevel", "unitPrice", supplier, "expiryDate", "createdAt", "updatedAt")
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::date, NOW(), NOW())`,
      [
        item.name,
        item.category,
        item.stockQty,
        item.minStockLevel,
        item.unitPrice,
        item.supplier,
        item.expiryDate,
      ],
    )
  }


  const rows = await client.query(
    'SELECT name, category, "stockQty", "unitPrice" FROM inventory ORDER BY category, name',
  )
  console.log(`\nSeeded ${rows.rows.length} inventory items:`)
  for (const row of rows.rows) {
    console.log(
      `  [${row.category}] ${row.name} — qty ${row.stockQty} · ৳${row.unitPrice}`,
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

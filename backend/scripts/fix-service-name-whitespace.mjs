import seedScope from './seed-scope.cjs'
/**
 * One-shot cleanup: strip trailing/leading tabs & spaces from service names.
 *
 * Why: production rows were saved as e.g. "Party StyleDesk\t", while booking
 * pricing trims labels → exact name match fails → service price = 0.
 *
 * Usage (from server/ with DB env loaded):
 *   node scripts/fix-service-name-whitespace.mjs
 */
import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new Client({ connectionString: url })
  await client.connect()
  await client.query('BEGIN')
  await seedScope(client)

  const before = await client.query(
    `SELECT id, name, length(name) AS len
     FROM service
     WHERE name <> btrim(name, E' \\t\\n\\r')
     ORDER BY name`,
  )
  console.log(`Services with outer whitespace: ${before.rowCount}`)
  for (const row of before.rows) {
    console.log('  before:', JSON.stringify(row.name), 'len=', row.len)
  }

  const result = await client.query(
    `UPDATE service
     SET name = btrim(name, E' \\t\\n\\r'),
         "updatedAt" = NOW()
     WHERE name <> btrim(name, E' \\t\\n\\r')
     RETURNING id, name`,
  )
  console.log(`Updated: ${result.rowCount}`)
  for (const row of result.rows) {
    console.log('  after:', JSON.stringify(row.name))
  }

  await client.query('COMMIT')
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    
    // 1. Get all existing employees
    console.log('Fetching existing employees...');
    const employeesRes = await client.query('SELECT id, name, role, salary FROM "employee"');
    const employees = employeesRes.rows;
    console.log(`Found ${employees.length} employees.`);

    if (employees.length === 0) {
      console.log('No employees found.');
      return;
    }

    const months = [3, 4, 5]; // March, April, May
    const year = 2026;

    for (const month of months) {
      console.log(`Checking payroll records for ${month}/${year}...`);
      for (const emp of employees) {
        const existing = await client.query(
          'SELECT id FROM "payroll" WHERE "employeeId" = $1 AND "month" = $2 AND "year" = $3',
          [emp.id, month, year]
        );

        if (existing.rows.length === 0) {
          const baseSalary = parseFloat(emp.salary) || 0;
          await client.query(
            `INSERT INTO "payroll" (
              "employeeId", "employeeName", "role", "baseSalary", 
              "bonus", "deductions", "netSalary", "status", 
              "month", "year", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
            [
              emp.id, emp.name, emp.role, baseSalary,
              0, 0, baseSalary, 'Pending',
              month, year
            ]
          );
          console.log(`Created payroll for ${emp.name} - ${month}/${year}`);
        }
      }
    }
    console.log('Finished seeding historical payroll records.');

  } catch (err) {
    console.error('Error during seeding:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

run();

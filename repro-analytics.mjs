import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const months = 6;
const from = new Date("2026-08-08T00:00:00.000Z");
const to = new Date("2026-08-15T00:00:00.000Z");
try {
  const [rows] = await conn.execute(
    `select date_format(b.createdAt, '%Y-%m'), count(*), coalesce(sum(b.totalPesewas), 0), coalesce(sum(i.quantity), 0)
     from bookings b
     left join booking_items i on b.id = i.bookingId
     where b.status != 'cancelled'
       and b.createdAt > date_sub(now(), interval ? month)
       and b.visitDate >= ?
       and b.visitDate < ?
     group by date_format(b.createdAt, '%Y-%m')
     order by 1 ASC`,
    [months, from, to],
  );
  console.log("OK", JSON.stringify(rows));
} catch (e) {
  console.error("ERROR:", e.message);
}
await conn.end();

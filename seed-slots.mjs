import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const rows = await conn.query("SELECT id, name FROM attractions WHERE isActive = 1 ORDER BY id");
const attractions = rows[0];

const slotDefs = [
  { start: "09:00", end: "09:45", label: "Morning (9:00 – 9:45)" },
  { start: "11:00", end: "11:45", label: "Late Morning (11:00 – 11:45)" },
  { start: "14:00", end: "14:45", label: "Afternoon (14:00 – 14:45)" },
  { start: "16:00", end: "16:45", label: "Late Afternoon (16:00 – 16:45)" },
];

for (const a of attractions) {
  const [existing] = await conn.query(
    "SELECT COUNT(*) AS c FROM tour_slots WHERE attractionId = ?",
    [a.id],
  );
  if (existing[0].c > 0) {
    console.log(`Attraction ${a.id} (${a.name}) already has slots — skipping`);
    continue;
  }
  for (const s of slotDefs) {
    await conn.query(
      "INSERT INTO tour_slots (attractionId, startTime, endTime, label, maxCapacity, bookedCount, isActive) VALUES (?, ?, ?, ?, 25, 0, 1)",
      [a.id, s.start, s.end, s.label],
    );
  }
  console.log(`Seeded ${slotDefs.length} slots for attraction ${a.id} (${a.name})`);
}

await conn.end();
console.log("Done.");

// Seed script: KNMP attractions + visitor categories (one-shot, idempotent-ish)
import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const assets = {
  hero: "/manus-storage/knmp_hero_6e87e968.webp",
  mausoleum: "/manus-storage/knmp_mausoleum_exterior_d8ce445c.jpg",
  fountain: "/manus-storage/knmp_mausoleum_fountain_0ffafc90.jpg",
  gardens: "/manus-storage/knmp_pool_gardens_339eca09.jpg",
  museum: "/manus-storage/knmp_museum_interior_34dcfe44.jpg",
  exhibits: "/manus-storage/knmp_exhibits_527cf551.jpg",
  statue: "/manus-storage/knmp_statue_closeup_7a9971ab.jpg",
};

const attractions = [
  {
    name: "The Mausoleum",
    slug: "mausoleum",
    description:
      "The centrepiece of the park. Dr. Kwame Nkrumah rests here in a glass-lined tomb beneath a white marble structure modelled on a traditional Ashanti stool, surrounded by a reflecting pool and statues of liberation heroes.",
    imageUrl: assets.mausoleum,
    openingHours: "9:00am–7:00pm",
    location: "Central grounds",
    averageVisitDurationMin: 45,
    sortIndex: 0,
    lat: 5.5503512,
    lng: -0.2112435,
  },
  {
    name: "Museum & Gallery",
    slug: "museum-gallery",
    description:
      "Houses a rich collection of artefacts, photographs and personal items from Dr. Nkrumah's life — from his early years to his role as the first Prime Minister and President of Ghana, and architect of the independence movement.",
    imageUrl: assets.museum,
    openingHours: "9:00am–6:00pm",
    location: "Main gallery building",
    averageVisitDurationMin: 60,
    sortIndex: 1,
    lat: 5.5507843,
    lng: -0.2105628,
  },
  {
    name: "Presidential Library",
    slug: "presidential-library",
    description:
      "A research library containing over 4,000 books, documents and manuscripts relating to Dr. Nkrumah's writings, the independence struggle and the history of Ghana.",
    imageUrl: assets.exhibits,
    openingHours: "9:00am–5:00pm",
    location: "Library wing",
    averageVisitDurationMin: 40,
    sortIndex: 2,
    lat: 5.5509621,
    lng: -0.2101287,
  },
  {
    name: "Statues & Fountains",
    slug: "statues-fountains",

    description:
      "Dramatic bronze statues of Nkrumah and his companions raising their hands in liberation, set against a backdrop of ornamental fountains and manicured grounds — the park's most photographed spot.",
    imageUrl: assets.fountain,
    openingHours: "9:00am–7:00pm",
    location: "Memorial forecourt",
    averageVisitDurationMin: 30,
    sortIndex: 3,
    lat: 5.5512074,
    lng: -0.2108956,
  },
  {
    name: "Gardens & Pool",
    slug: "gardens-pool",
    description:
      "Lush tropical gardens, shaded walkways and the serene reflecting pool encircling the mausoleum offer a peaceful retreat in the heart of Accra.",
    imageUrl: assets.gardens,
    openingHours: "9:00am–7:00pm",
    location: "Park grounds",
    averageVisitDurationMin: 30,
    sortIndex: 4,
    lat: 5.5500298,
    lng: -0.2106714,
  },
  {
    name: "Audio-Visual Tunnel",
    slug: "audio-visual-tunnel",
    description:
      "A multimedia exhibit presenting footage and recordings from the independence era, tracing Nkrumah's journey from student abroad to founding father of Ghana.",
    imageUrl: assets.exhibits,
    openingHours: "10:00am–6:00pm",
    location: "Exhibition hall",
    averageVisitDurationMin: 20,
    sortIndex: 5,
    lat: 5.5506184,
    lng: -0.2110502,
  },
  {
    name: "Founders' Hall Viewpoint",
    slug: "founders-hall-viewpoint",
    description:
      "An elevated vantage point offering panoramic views of the memorial complex, ideal for photography of the mausoleum, gardens and Accra skyline.",
    imageUrl: assets.hero,
    openingHours: "9:00am–6:00pm",
    location: "North grounds",
    averageVisitDurationMin: 20,
    sortIndex: 6,
    lat: 5.5514327,
    lng: -0.2103119,
  },
  {
    name: "Gift Shop & Restaurant",
    slug: "gift-shop-restaurant",
    description:
      "Pick up books, craft souvenirs and replicas, then enjoy a meal or refreshment overlooking the park before your departure.",
    imageUrl: assets.gardens,
    openingHours: "9:00am–8:00pm",
    location: "Park entrance",
    averageVisitDurationMin: 30,
    sortIndex: 7,
    lat: 5.5498056,
    lng: -0.2109843,
  },
];

const categories = [
  {
    name: "Adult (Ghanaian)",
    slug: "adult-ghanaian",
    description: "Ages 18 and above, Ghanaian residents",
    pricePesewas: 2500,
    sortIndex: 0,
  },
  {
    name: "Student (Ghanaian, Tertiary)",
    slug: "student-tertiary",
    description: "Tertiary students with valid student ID",
    pricePesewas: 1500,
    sortIndex: 1,
  },
  {
    name: "SHS / JHS Student (Ghanaian)",
    slug: "shs-jhs-student",
    description: "Senior high and junior high students in uniform with ID",
    pricePesewas: 1000,
    sortIndex: 2,
  },
  {
    name: "Child (Ghanaian)",
    slug: "child-ghanaian",
    description: "Ages 4–17, Ghanaian residents",
    pricePesewas: 500,
    sortIndex: 3,
  },
  {
    name: "Foreign Adult",
    slug: "foreign-adult",
    description: "Non-Ghanaian visitors, ages 18 and above",
    pricePesewas: 10000,
    sortIndex: 4,
  },
  {
    name: "Foreign Student",
    slug: "foreign-student",
    description: "Non-Ghanaian students with valid ID",
    pricePesewas: 6000,
    sortIndex: 5,
  },
  {
    name: "Foreign Child",
    slug: "foreign-child",
    description: "Non-Ghanaian visitors, ages 4–17",
    pricePesewas: 3000,
    sortIndex: 6,
  },
  {
    name: "ECOWAS Visitor",
    slug: "ecowas-visitor",
    description: "Visitors from ECOWAS member states (concessional rate)",
    pricePesewas: 5000,
    sortIndex: 7,
  },
];

for (const a of attractions) {
  const [existing] = await conn.execute("SELECT id FROM attractions WHERE slug = ?", [a.slug]);
  if (!existing.length) {
    await conn.execute(
      `INSERT INTO attractions (name, slug, description, imageUrl, openingHours, location, lat, lng, averageVisitDurationMin, sortIndex, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [a.name, a.slug, a.description, a.imageUrl, a.openingHours, a.location, a.lat, a.lng, a.averageVisitDurationMin, a.sortIndex],
    );
    console.log(`Seeded attraction: ${a.name}`);
  }
}

for (const c of categories) {
  const [existing] = await conn.execute("SELECT id FROM visitor_categories WHERE slug = ?", [c.slug]);
  if (!existing.length) {
    await conn.execute(
      `INSERT INTO visitor_categories (name, slug, description, pricePesewas, sortIndex, isActive)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [c.name, c.slug, c.description, c.pricePesewas, c.sortIndex],
    );
    console.log(`Seeded category: ${c.name} @ GH₵${(c.pricePesewas / 100).toFixed(2)}`);
  }
}

// Sample events: special programs and guided tours (dates relative, future-facing)
const mausoleum = attractions.find(a => a.slug === "mausoleum");
const museum = attractions.find(a => a.slug === "museum");
const gardens = attractions.find(a => a.slug === "gardens");
const today = new Date();
const plusDays = n => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n));
const events = [
  {
    title: "Independence Day Special Program",
    slug: "independence-day-special",
    description:
      "Join us for a special Independence Day commemoration featuring wreath-laying at the Mausoleum, live drumming, and readings from Nkrumah's works. Open to all visitors.",
    eventType: "program",
    attractionId: mausoleum?.id ?? null,
    eventDate: plusDays(12),
    startTime: "09:00",
    endTime: "12:00",
    meetingPoint: "Main entrance forecourt",
    guideName: "Dr. A. Biney",
    capacity: 0,
    feePesewas: 0,
    registrationDeadline: null,
    isPublished: true,
    sortIndex: 0,
  },
  {
    title: "Mausoleum Guided Heritage Tour",
    slug: "mausoleum-guided-heritage-tour",
    description:
      "A guided walk through the Kwame Nkrumah Mausoleum and its grounds: the glass-lined tomb, the liberation-heroes statues, and the reflecting pool, with stories of the independence movement.",
    eventType: "guided_tour",
    attractionId: mausoleum?.id ?? null,
    eventDate: plusDays(6),
    startTime: "10:00",
    endTime: "11:30",
    meetingPoint: "Mausoleum entrance steps",
    guideName: "Mr. O. Mensah",
    capacity: 25,
    feePesewas: 2000,
    registrationDeadline: plusDays(5),
    isPublished: true,
    sortIndex: 1,
  },
  {
    title: "Museum Artefacts & Archives Tour",
    slug: "museum-artefacts-archives-tour",
    description:
      "Explore the museum galleries with a curator: personal belongings of Dr. Nkrumah, independence-era photographs and documents, and the audio-visual archive collection.",
    eventType: "guided_tour",
    attractionId: museum?.id ?? null,
    eventDate: plusDays(9),
    startTime: "14:00",
    endTime: "15:30",
    meetingPoint: "Museum front desk",
    guideName: "Mrs. E. Adjei",
    capacity: 15,
    feePesewas: 1500,
    registrationDeadline: null,
    isPublished: true,
    sortIndex: 2,
  },
  {
    title: "Weekend Gardens & Library Walk",
    slug: "gardens-library-walk",
    description:
      "A relaxed guided stroll through the pool gardens and a stop at the memorial library, with time for photographs and questions about the park's landscape design.",
    eventType: "guided_tour",
    attractionId: gardens?.id ?? null,
    eventDate: plusDays(3),
    startTime: "08:30",
    endTime: "09:30",
    meetingPoint: "Gardens pathway entrance",
    guideName: "Mr. K. Boateng",
    capacity: 20,
    feePesewas: 0,
    registrationDeadline: null,
    isPublished: true,
    sortIndex: 3,
  },
];
for (const e of events) {
  const [existing] = await conn.execute("SELECT id FROM events WHERE slug = ?", [e.slug]);
  if (!existing.length) {
    const deadline = e.registrationDeadline
      ? deadlineString(e.registrationDeadline)
      : null;
    await conn.execute(
      `INSERT INTO events (title, slug, description, eventType, attractionId, eventDate, startTime, endTime, meetingPoint, guideName, capacity, feePesewas, registrationDeadline, isPublished, sortIndex)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.title, e.slug, e.description, e.eventType, e.attractionId, dateString(e.eventDate), e.startTime, e.endTime, e.meetingPoint, e.guideName, e.capacity, e.feePesewas, deadline, e.isPublished, e.sortIndex],
    );
    console.log(`Seeded event: ${e.title} (${e.eventType})`);
  }
}

function dateString(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function deadlineString(d) {
  return dateString(d);
}

await conn.end();
console.log("Seed complete.");
process.exit(0);

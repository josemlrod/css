export type Tour = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  duration: string;
  durationMinutes: number;
  price: number;
  maxGuests: number;
  rating: number;
  reviewCount: number;
  image: string;
  category: 'Historic' | 'Ghost' | 'Food' | 'Nature';
  highlights: string[];
  startTimes: string[];
  meetingPoint: string;
};

export const tours: Tour[] = [
  {
    id: 't-001',
    slug: 'historic-district-walking',
    name: 'Historic District Walking Tour',
    tagline: 'Two centuries of stories under the oaks',
    description:
      "Stroll through Savannah's famous squares with a local historian and uncover the city's antebellum past.",
    longDescription:
      "Walk beneath century-old live oaks dripping with Spanish moss as your guide brings Savannah's golden age to life. We'll visit five of the city's twenty-two historic squares, pause at the homes of Revolutionary War heroes, and step inside one of the oldest churches in the South. Comfortable shoes recommended.",
    duration: '2 hours',
    durationMinutes: 120,
    price: 38,
    maxGuests: 12,
    rating: 4.9,
    reviewCount: 412,
    image: '/tours/historic-square.jpg',
    category: 'Historic',
    highlights: [
      'Five historic squares',
      'Mercer-Williams House exterior',
      'Colonial Park Cemetery',
      'Local historian guide',
    ],
    startTimes: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'],
    meetingPoint: 'Chippewa Square fountain',
  },
  {
    id: 't-002',
    slug: 'haunted-savannah-ghost',
    name: 'Haunted Savannah Ghost Tour',
    tagline: "America's most haunted city after dark",
    description:
      "A lantern-lit walk through the shadowy lanes where Savannah's most restless spirits still linger.",
    longDescription:
      "When the gas lamps flicker on, Savannah reveals her darker side. Follow your storyteller through dimly-lit cobblestone streets to the city's most notoriously haunted addresses. Hear documented accounts from residents, see locations featured on national paranormal shows, and decide for yourself.",
    duration: '90 minutes',
    durationMinutes: 90,
    price: 32,
    maxGuests: 20,
    rating: 4.8,
    reviewCount: 1287,
    image: '/tours/ghost-tour.jpg',
    category: 'Ghost',
    highlights: [
      'Lantern-lit walking tour',
      'Six haunted locations',
      'Featured on Travel Channel',
      'Family-friendly storytelling',
    ],
    startTimes: ['7:30 PM', '9:00 PM', '10:30 PM'],
    meetingPoint: 'Reynolds Square, beneath the John Wesley statue',
  },
  {
    id: 't-003',
    slug: 'river-street-twilight',
    name: 'River Street Twilight Stroll',
    tagline: 'Cobblestones, cotton warehouses & golden light',
    description:
      'An easy riverside walk along the restored cotton exchange district as the sun sets over the Savannah River.',
    longDescription:
      "Begin at Factor's Walk overlooking the river, then descend the famous ballast-stone ramps to River Street itself. Your guide will trace the path of cotton, indigo and Atlantic trade that built the city, with tastings at two historic establishments along the way.",
    duration: '2 hours',
    durationMinutes: 120,
    price: 45,
    maxGuests: 15,
    rating: 4.7,
    reviewCount: 638,
    image: '/tours/river-street.jpg',
    category: 'Historic',
    highlights: [
      "Factor's Walk overlook",
      'Two tasting stops',
      'Sunset views',
      'Cotton exchange history',
    ],
    startTimes: ['5:00 PM', '6:30 PM'],
    meetingPoint: 'City Hall, Bay Street entrance',
  },
  {
    id: 't-004',
    slug: 'southern-flavors-food',
    name: 'Southern Flavors Food Tour',
    tagline: 'Six tastings, three centuries of Lowcountry cooking',
    description:
      'Eat your way through the Historic District with stops at six locally-owned kitchens.',
    longDescription:
      "From shrimp and grits to a still-warm praline, this tour is a slow afternoon of Lowcountry classics paired with the stories of the families and immigrants who shaped Savannah's table. Comes with a complimentary sweet tea and a copy of our seasonal recipe card.",
    duration: '3 hours',
    durationMinutes: 180,
    price: 79,
    maxGuests: 10,
    rating: 4.9,
    reviewCount: 524,
    image: '/tours/food-tour.jpg',
    category: 'Food',
    highlights: [
      'Six tastings included',
      'Family-run kitchens',
      'Vegetarian options',
      'Seasonal recipe card',
    ],
    startTimes: ['11:30 AM', '1:00 PM'],
    meetingPoint: "Broughton & Bull Street, in front of Leopold's",
  },
  {
    id: 't-005',
    slug: 'carriage-through-squares',
    name: 'Carriage Through the Squares',
    tagline: 'The classic Savannah arrival, by horse-drawn carriage',
    description:
      'A relaxed narrated ride through the Historic District beneath the oaks.',
    longDescription:
      "Climb aboard a beautifully restored carriage drawn by Belgian draft horses and let the clip-clop of hooves on cobblestone set the pace. Your driver-guide narrates a one-hour loop through the most picturesque squares and past the city's grandest mansions. Blankets provided in winter.",
    duration: '60 minutes',
    durationMinutes: 60,
    price: 52,
    maxGuests: 14,
    rating: 4.6,
    reviewCount: 891,
    image: '/tours/trolley.jpg',
    category: 'Historic',
    highlights: [
      'Restored carriage',
      'Belgian draft horses',
      'All-weather covered',
      'Wheelchair accessible',
    ],
    startTimes: ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'],
    meetingPoint: 'City Market, Jefferson Street side',
  },
  {
    id: 't-006',
    slug: 'forsyth-morning',
    name: 'Forsyth Park Morning Walk',
    tagline: 'Coffee, fountains & live oaks at dawn',
    description:
      "A gentle morning walk through Savannah's largest park with coffee and pastry included.",
    longDescription:
      "Start the day the local way: a slow loop around Forsyth Park while the city is still quiet. Your guide brings a thermos of strong chicory coffee and a bag of fresh pastries from a neighborhood bakery. We'll cover the park's military history, the fountain's storied past, and the city's beloved Confederate Jasmine.",
    duration: '75 minutes',
    durationMinutes: 75,
    price: 28,
    maxGuests: 8,
    rating: 4.8,
    reviewCount: 207,
    image: '/tours/forsyth-park.jpg',
    category: 'Nature',
    highlights: [
      'Coffee & pastry',
      'Small group of 8',
      'Forsyth Fountain',
      'Locally-sourced treats',
    ],
    startTimes: ['7:30 AM', '9:00 AM'],
    meetingPoint: 'Forsyth Park, north fountain entrance',
  },
];

export type Review = {
  id: string;
  tourId: string;
  tourName: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  status: 'approved' | 'pending' | 'flagged';
};

export const reviews: Review[] = [
  {
    id: 'r-001',
    tourId: 't-001',
    tourName: 'Historic District Walking Tour',
    author: 'Margaret H.',
    rating: 5,
    date: '2026-05-08',
    title: 'An unforgettable afternoon',
    body: "Our guide knew every brick of every square. Three hours flew by and I left feeling like I'd actually met Savannah, not just seen it.",
    status: 'approved',
  },
  {
    id: 'r-002',
    tourId: 't-002',
    tourName: 'Haunted Savannah Ghost Tour',
    author: 'Daniel K.',
    rating: 5,
    date: '2026-05-10',
    title: 'Genuinely chilling',
    body: 'The lanterns, the fog rolling in off the river, the stories that are all actually documented. My partner refused to walk on that street again.',
    status: 'pending',
  },
  {
    id: 'r-003',
    tourId: 't-004',
    tourName: 'Southern Flavors Food Tour',
    author: 'Priya S.',
    rating: 5,
    date: '2026-05-11',
    title: 'We did not need dinner',
    body: 'Six stops and every single one was a highlight. The praline guy alone is worth the price of admission. Vegetarian options were great too.',
    status: 'approved',
  },
  {
    id: 'r-004',
    tourId: 't-003',
    tourName: 'River Street Twilight Stroll',
    author: 'James W.',
    rating: 4,
    date: '2026-05-09',
    title: 'Beautiful but crowded',
    body: 'The history is fantastic and the tastings were generous. Just be warned River Street itself gets busy at sunset on weekends.',
    status: 'approved',
  },
  {
    id: 'r-005',
    tourId: 't-002',
    tourName: 'Haunted Savannah Ghost Tour',
    author: 'Anonymous',
    rating: 1,
    date: '2026-05-12',
    title: 'WORST TOUR EVER GO ELSEWHERE',
    body: 'Guide showed up late and the whole thing was a scam. DO NOT BOOK THIS!!! Call me at 555-0199 for refund advice.',
    status: 'flagged',
  },
  {
    id: 'r-006',
    tourId: 't-005',
    tourName: 'Carriage Through the Squares',
    author: 'Eleanor R.',
    rating: 5,
    date: '2026-05-07',
    title: 'Like stepping back in time',
    body: "The horses were beautifully cared for and our driver was a born storyteller. The kids haven't stopped talking about it.",
    status: 'approved',
  },
  {
    id: 'r-007',
    tourId: 't-006',
    tourName: 'Forsyth Park Morning Walk',
    author: 'Chen L.',
    rating: 5,
    date: '2026-05-13',
    title: 'The best way to start the day',
    body: 'The coffee was strong, the pastries were warm, and the park at 8am is pure magic. Our guide felt like a friend showing us around.',
    status: 'pending',
  },
  {
    id: 'r-008',
    tourId: 't-001',
    tourName: 'Historic District Walking Tour',
    author: 'Robert T.',
    rating: 5,
    date: '2026-05-06',
    title: 'Worth every penny',
    body: 'Booked on a whim, ended up being the best part of our trip. Pace was relaxed, content was rich.',
    status: 'approved',
  },
];

export type Booking = {
  id: string;
  tourId: string;
  tourName: string;
  guest: string;
  email: string;
  guests: number;
  date: string;
  time: string;
  total: number;
  status: 'confirmed' | 'completed' | 'cancelled';
};

export const bookings: Booking[] = [
  {
    id: 'b-1001',
    tourId: 't-001',
    tourName: 'Historic District Walking',
    guest: 'Margaret Hayes',
    email: 'm.hayes@example.com',
    guests: 2,
    date: '2026-05-18',
    time: '11:00 AM',
    total: 76,
    status: 'confirmed',
  },
  {
    id: 'b-1002',
    tourId: 't-002',
    tourName: 'Haunted Savannah Ghost',
    guest: 'Daniel Kim',
    email: 'dk@example.com',
    guests: 4,
    date: '2026-05-18',
    time: '9:00 PM',
    total: 128,
    status: 'confirmed',
  },
  {
    id: 'b-1003',
    tourId: 't-004',
    tourName: 'Southern Flavors Food',
    guest: 'Priya Singh',
    email: 'p.singh@example.com',
    guests: 2,
    date: '2026-05-19',
    time: '1:00 PM',
    total: 158,
    status: 'confirmed',
  },
  {
    id: 'b-1004',
    tourId: 't-005',
    tourName: 'Carriage Through Squares',
    guest: 'Eleanor Reyes',
    email: 'e.reyes@example.com',
    guests: 3,
    date: '2026-05-19',
    time: '2:00 PM',
    total: 156,
    status: 'confirmed',
  },
  {
    id: 'b-1005',
    tourId: 't-003',
    tourName: 'River Street Twilight',
    guest: 'James Walker',
    email: 'jw@example.com',
    guests: 2,
    date: '2026-05-20',
    time: '6:30 PM',
    total: 90,
    status: 'confirmed',
  },
  {
    id: 'b-1006',
    tourId: 't-006',
    tourName: 'Forsyth Park Morning',
    guest: 'Chen Liu',
    email: 'c.liu@example.com',
    guests: 2,
    date: '2026-05-21',
    time: '9:00 AM',
    total: 56,
    status: 'confirmed',
  },
  {
    id: 'b-1007',
    tourId: 't-001',
    tourName: 'Historic District Walking',
    guest: 'Robert Tan',
    email: 'r.tan@example.com',
    guests: 4,
    date: '2026-05-15',
    time: '2:00 PM',
    total: 152,
    status: 'completed',
  },
  {
    id: 'b-1008',
    tourId: 't-002',
    tourName: 'Haunted Savannah Ghost',
    guest: 'Aisha Brooks',
    email: 'a.brooks@example.com',
    guests: 2,
    date: '2026-05-14',
    time: '7:30 PM',
    total: 64,
    status: 'completed',
  },
];

// Revenue & bookings over the last 14 days (for dashboard charts)
export const revenueByDay = [
  { date: 'Apr 30', bookings: 12, revenue: 612 },
  { date: 'May 01', bookings: 18, revenue: 942 },
  { date: 'May 02', bookings: 22, revenue: 1180 },
  { date: 'May 03', bookings: 28, revenue: 1490 },
  { date: 'May 04', bookings: 16, revenue: 820 },
  { date: 'May 05', bookings: 14, revenue: 738 },
  { date: 'May 06', bookings: 20, revenue: 1078 },
  { date: 'May 07', bookings: 24, revenue: 1296 },
  { date: 'May 08', bookings: 31, revenue: 1654 },
  { date: 'May 09', bookings: 36, revenue: 2018 },
  { date: 'May 10', bookings: 29, revenue: 1547 },
  { date: 'May 11', bookings: 26, revenue: 1428 },
  { date: 'May 12', bookings: 33, revenue: 1812 },
  { date: 'May 13', bookings: 41, revenue: 2284 },
];

export const tourPopularity = [
  { tour: 'Ghost', bookings: 412 },
  { tour: 'Walking', bookings: 318 },
  { tour: 'Carriage', bookings: 287 },
  { tour: 'Food', bookings: 224 },
  { tour: 'River', bookings: 196 },
  { tour: 'Forsyth', bookings: 112 },
];

export const stats = {
  totalRevenue: 18899,
  totalBookings: 350,
  averageRating: 4.8,
  pendingReviews: 2,
  revenueChange: 12.4,
  bookingsChange: 8.2,
  ratingChange: 0.1,
};

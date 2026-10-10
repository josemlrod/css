import type { NormalizedTour } from '../app/lib/types';

type CatalogTour = Omit<NormalizedTour, 'blockedDates' | 'test'>;

// Bookable tours from https://cinematicsitesofsavannah.com/savannah-movie-tours/.
// Names, copy, prices, durations, and images match each tour's page on that site so the
// handoff from WordPress feels continuous. Images are the cards visitors click on the Tours page.
//
// Start times, capacity, and meeting point belong to Operators, so new tours start without them
// and stay hidden from Bookers until an Operator sets them in /admin/tours (see isTourReady).
// Reseeding never overwrites them.
//
// "Movies Along the Marsh Boat Tour" is left out while the site lists it as Closed for the Season.
const operatorSettings = { maxGuests: 0, startTimes: [], meetingPoint: '' };

export const tours: CatalogTour[] = [
  {
    slug: 'midnight-in-the-garden',
    name: 'Behind the Scenes Tour: Midnight in the Garden of Good and Evil',
    tagline: 'All ages welcome!',
    description:
      'Focusing on the film that sparked a surge in Savannah tourism, the Behind the Scenes Tour introduces you to 4 of the most famous locations in Midnight in the Garden of Good and Evil.',
    longDescription: [
      'Do you know what really happened behind the scenes in Midnight in the Garden of Good and Evil?',
      'Focusing on the film that sparked a surge in Savannah tourism, the Behind the Scenes Tour introduces you to 4 of the most famous locations in Midnight in the Garden of Good and Evil.',
      'This tour gives you a glimpse backstage, highlighting key differences between John Berendt’s 1994 novel and Clint Eastwood’s 1997 film.',
      'In addition to a walk down one of America’s most beautiful streets, you’ll experience the first-hand charm of:\n1. Forsyth Park – one of Savannah’s most romantic spots\n2. Clary’s Cafe – the “spot for gossip in the South”\n3. Jones Street – “three parts liquor, one part punch”, the most beautiful street in America\n4. Mercer Williams House Museum – home of the famous murder (admission ticket not included)',
      'Our most popular tour for families.',
    ].join('\n\n'),
    duration: '75 minutes',
    durationMinutes: 75,
    price: 30,
    imageUrl: '/tours/midnight-in-the-garden.jpg',
    category: 'Day',
    highlights: [
      'Forsyth Park',
      'Clary’s Cafe',
      'Jones Street',
      'Mercer Williams House Museum',
    ],
    ...operatorSettings,
  },
  {
    slug: 'tails-of-savannah',
    name: 'Tails of Savannah: A Family Walking Tour',
    tagline: 'All ages welcome!',
    description:
      'Bring the whole pack for Savannah’s most heartwarming adventure! Inspired by one of Disney’s most beloved animated classics, this family-friendly walking tour takes you through the Savannah locations connected to the story’s most memorable moments.',
    longDescription: [
      'Bring the whole pack for Savannah’s most heartwarming adventure! Inspired by one of Disney’s most beloved animated classics, this family-friendly walking tour takes you through the Savannah locations connected to the story’s most memorable moments.',
      'Begin your journey along the historic waterfront, where you’ll spot the iconic riverboat, then stroll to the romantic setting that inspired the famous spaghetti dinner scene. Visit Johnson Square, where the lovable stray pulls off his memorable sandwich heist, peek into the pet shop and alleyway near Wright Square, and finish at beautiful St. John’s Church in Lafayette Square, just as the story begins.',
      'Perfect for Disney fans, dog lovers, and families alike, this charming walking tour brings movie magic and Savannah history together for a tail-wagging adventure you’ll never forget.',
      'This tour is an independent experience and is not affiliated with, sponsored by, endorsed by, or licensed by The Walt Disney Company.',
    ].join('\n\n'),
    duration: '75 minutes',
    durationMinutes: 75,
    price: 29,
    imageUrl: '/tours/tails-of-savannah.jpg',
    category: 'Day',
    highlights: [
      'Historic waterfront',
      'Johnson Square',
      'Wright Square',
      'St. John’s Church',
    ],
    ...operatorSettings,
  },
  {
    slug: 'reel-savannah',
    name: 'Reel Savannah: A Hollywood History Tour',
    tagline: 'All ages welcome!',
    description:
      'Walk through the real filming locations of Forrest Gump, Midnight in the Garden of Good and Evil, Manhunt, Marvel blockbusters, and more while discovering the fascinating stories that made Savannah one of Hollywood’s favorite cities.',
    longDescription:
      'Step into the movies and discover Savannah like never before on Reel Savannah: A Hollywood History Tour. Walk through the real filming locations of Forrest Gump, Midnight in the Garden of Good and Evil, Manhunt, Marvel blockbusters, and more while discovering the fascinating stories that made Savannah one of Hollywood’s favorite cities. Along the way, uncover fascinating behind-the-scenes secrets, legendary actors, and the rich history that has made Savannah one of America’s favorite filming destinations. Whether you’re a movie buff, history lover, or first-time visitor, this tour offers an unforgettable look at the city where history and Hollywood meet.',
    duration: '60 minutes',
    durationMinutes: 60,
    price: 29,
    imageUrl: '/tours/reel-savannah.jpg',
    category: 'Day',
    highlights: [
      'Forrest Gump',
      'Midnight in the Garden of Good and Evil',
      'Manhunt',
      'Marvel blockbusters',
    ],
    ...operatorSettings,
  },
  {
    slug: 'haunted-hot-spots',
    name: 'Savannah’s Haunted Hot Spots: Reality TV’s #1 Ghost Hunter Spots',
    tagline: 'All ages welcome!',
    description:
      'Step into the supernatural scenes that caught the attention of top ghost-hunting TV shows. From Ghost Hunters to Portals to Hell, join us as we uncover the real stories behind Savannah’s most haunted places.',
    longDescription: [
      'Step into the supernatural scenes that caught the attention of top ghost-hunting TV shows. From Ghost Hunters to Portals to Hell, join us as we uncover the real stories behind Savannah’s most haunted places. Walk through eerie, historic sites where paranormal investigators filmed spine-chilling encounters. With a guide sharing insider details on each location’s ghostly past, experience the thrill of Savannah’s paranormal legacy firsthand.',
      'Tour Stops:\nJohnson Square – where the dark side of Savannah comes to life\nThe Marshall House, Historic Inns of Savannah – housed soldiers during the war\nThe Old Sorrel Weed House Museum & Tours – hear the tale of Matilda and her husband\nHamilton-Turner House – learn about the ghosts that haunt this famous Inn\n17Hundred90 Inn and Restaurant – learn about the ghosts that taunt the guest during dinner\nKehoe House, Historic Inns of Savannah – learn about the cigar smoking ghosts that haunt the roof\nHistoric Savannah Theatre – learn about its history and the fire that destroyed it and its guests',
    ].join('\n\n'),
    duration: '60–90 minutes',
    durationMinutes: 90,
    price: 29,
    imageUrl: '/tours/haunted-hot-spots.jpg',
    category: 'Night',
    highlights: [
      'Johnson Square',
      'The Marshall House',
      'Sorrel Weed House',
      'Hamilton-Turner House',
      '17Hundred90 Inn',
      'Kehoe House',
      'Historic Savannah Theatre',
    ],
    ...operatorSettings,
  },
  {
    slug: 'toasting-savannahs-past',
    name: 'Toasting Savannah’s Past Pub Tour',
    tagline: '21+',
    description:
      'Your adventure begins with a welcome drink at Abe’s on Lincoln, where you’ll discover Savannah’s unique drinking culture, colorful history, and fascinating local traditions.',
    longDescription:
      'Your adventure begins with a welcome drink at Abe’s on Lincoln, where you’ll discover Savannah’s unique drinking culture, colorful history, and fascinating local traditions. From there, you’ll make your way to the historic 1790 Inn to uncover chilling ghost stories, legendary hauntings, and the real history behind one of Savannah’s most famous landmarks. The evening wraps up at McDonough’s, where you’ll enjoy the lively atmosphere while hearing entertaining tales of Savannah’s past and present, from colorful characters and local legends to the city’s vibrant nightlife. Along the way, your guide will share engaging stories, insider tips, fun trivia, and plenty of opportunities to raise a glass, making this the perfect blend of history, hospitality, and unforgettable memories.',
    duration: '80 minutes',
    durationMinutes: 80,
    price: 30,
    imageUrl: '/tours/toasting-savannahs-past.jpg',
    category: 'Night',
    highlights: [
      'Welcome drink at Abe’s on Lincoln',
      'The 1790 Inn',
      'McDonough’s',
      '21+',
    ],
    ...operatorSettings,
  },
];

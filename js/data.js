/**
 * data.js — Reading log entries
 *
 * Each entry: [month (1-12), day, title, author, genre, time, pages, thoughts]
 *
 * To add new entries, append rows to RAW_DATA following the same format.
 * Month is a number (1 = January, 2 = February, etc.)
 * Pages should be a number; use 0 if unknown.
 */

const READING_YEAR = 2025;

const RAW_DATA = [
  // ── January ──────────────────────────────────────────────────────
  [1, 16, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "34 mins", 43,
    "I am really happy I started this book. I actually have had this one in my night stand drawer since I got to CMU last semester, and never really made the time to read it. So far, the author stated some strong convictions about finance, and I am enjoying the point of view"],
  [1, 17, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "32 mins", 33,
    "I was reading slower today, maybe because it was later in the day so I am a little calmer or more tired. This book definitely makes me think a lot about my own mindset and reflect on how I can improve."],
  [1, 18, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "30 mins", 42,
    "This is a personal finance book, and possibly one of the most famous of our time. After hearing so many people talk about it, it is nice to finally read it myself and see how it applies to my family and our finances."],
  [1, 19, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "30 mins", 38,
    "The thing that stood out the most to me in the section I read today was how one should go about choosing the assets they invest in. The author says to invest in assets that you love, or else you won't be as successful in truly making money from it."],
  [1, 25, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "30 mins", 30,
    "This part was more exciting because the author actually started discussing what he invested in"],
  [1, 27, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "20 mins", 28,
    "This part discussed specific deals in real estate that the author had made in the past."],
  [1, 31, "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "30 mins", 33,
    "This part discussed the value in \"knowing a little about a lot.\" I liked this section because it feels relateable to my future in the military."],

  // ── February ─────────────────────────────────────────────────────
  [2, 1,  "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "30 mins", 29,
    "This section was more focused on the mindset behind being successful. Using failure as motivation rather than a reason to stop."],
  [2, 2,  "Rich Dad Poor Dad", "Robert T. Kiyosaki", "Self help", "65 mins", 44,
    "It has been enjoyable reading more often this semester. Finished the book today!"],
  [2, 7,  "Fahrenheit 451", "Ray Bradbury", "Dystopian", "30 mins", 18,
    "I am a little confused on what is happening so far, but hopefully I understand more as I read more."],
  [2, 8,  "Fahrenheit 451", "Ray Bradbury", "Dystopian", "34 mins", 30,
    "This weekend was the first time I felt like I had a real break since the second semester started, so it was really nice. I had some good ramen for lunch right before I read (Maneki Ramen), and that was very nice."],
  [2, 9,  "Fahrenheit 451", "Ray Bradbury", "Dystopian", "25 mins", 19,
    "I am enjoying the book so far. I remember starting it at some point a very long time ago (maybe 30 pages in), but I didn't find it interesting at the time."],
  [2, 16, "Fahrenheit 451", "Ray Bradbury", "Dystopian", "65 mins", 40,
    "Obviously, I left my reading to do today instead of spreading it out. The part that really resonates with me is Montag's frustrations about how it doesn't feel like people are truly listening."],
  [2, 18, "Fahrenheit 451", "Ray Bradbury", "Dystopian", "60 mins", 42,
    "I kind of expected him to kill Captain Beatty. I didn't feel like that was a huge twist since people tend to act impulsively when they feel cornered."],
  [2, 19, "Fahrenheit 451", "Ray Bradbury", "Dystopian", "15 mins", 10,
    "The ending was so much calmer than the rest of the book, and it felt like Montag was really seeing the world for the first time, which I liked."],
  [2, 22, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "30 mins", 20,
    "I like this book. It is about a girl and her uncle and their family's used bookstore. It is nice and slow and is a peaceful read so far."],
  [2, 23, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "30 mins", 25,
    "I realize now that this is actually the second book in the series. I am not sure what the first one is about, but it doesn't seem like I am missing any vital information."],
  [2, 24, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "20 mins", 15,
    "This book is from the perspective of a girl, Takako. So far, she is navigating her personal relationships while trying to balance work as well."],
  [2, 26, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "15 mins", 10,
    "I am very excited for a little reset during Spring Break."],

  // ── March ────────────────────────────────────────────────────────
  [3, 9,  "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "15 mins", 11,
    "Spring Break was great."],
  [3, 10, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "15 mins", 10,
    "I did not read much recently, I am going to do more once I get past this initial period of a lot of work."],
  [3, 12, "More Days at the Morisaki Bookshop", "Satoshi Yagisawa", "Slice of Life", "24 mins", 20,
    "I am not sure how to feel about this book. I enjoy the slow paced vibe and I feel like I can just imagine the world of the book, but I usually enjoy novels that have some type of message."],
];

/**
 * Parses RAW_DATA into structured entry objects.
 * @returns {Array<Object>} Array of reading session objects
 */
function parseEntries() {
  return RAW_DATA.map(([month, day, title, author, genre, time, pages, thoughts]) => ({
    month,
    day,
    dateKey: `${READING_YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    date:    new Date(READING_YEAR, month - 1, day),
    title,
    author,
    genre,
    time,
    pages,
    thoughts,
  }));
}

/**
 * Aggregates entries by date, summing pages and collecting sessions.
 * @param {Array<Object>} entries
 * @returns {Object} Map of dateKey → aggregated day object
 */
function aggregateByDate(entries) {
  const byDate = {};
  for (const entry of entries) {
    if (!byDate[entry.dateKey]) {
      byDate[entry.dateKey] = { ...entry, pages: 0, sessions: [] };
    }
    byDate[entry.dateKey].pages += entry.pages;
    byDate[entry.dateKey].sessions.push(entry);
    if (entry.title) byDate[entry.dateKey].title = entry.title;
  }
  return byDate;
}
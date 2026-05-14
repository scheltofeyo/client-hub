import type { Locale } from "./translations";

export type Greeting = { nl: string; en: string };

// Always eligible — used as a baseline pool so the rotation feels fresh
// regardless of when the survey is opened.
const universal: Greeting[] = [
  { nl: "Hallo daar — bedankt dat je meedoet.", en: "Hello there — thanks for joining in." },
  { nl: "Hoi! Fijn dat je tijd vrijmaakt.", en: "Hi there — glad you're making the time." },
  { nl: "Welkom — bedankt dat je dit invult.", en: "Welcome — thanks for filling this in." },
  { nl: "Goed dat je er bent.", en: "Good to have you here." },
  { nl: "Bedankt dat je even tijd voor ons maakt.", en: "Thanks for taking a moment with us." },
  { nl: "Top dat je meedoet — dat waarderen we.", en: "Great to have you — we really appreciate it." },
  { nl: "Fijn dat je hier bent. Laten we beginnen.", en: "Glad you're here. Let's get started." },
  { nl: "Goed je te zien — bedankt voor je tijd.", en: "Good to see you — thanks for your time." },
];

const morning: Greeting[] = [
  { nl: "Goedemorgen — fijn dat je er bent.", en: "Good morning — glad you're here." },
  { nl: "Goedemorgen! Bedankt dat je de tijd neemt.", en: "Good morning! Thanks for taking the time." },
  { nl: "Een frisse start — dankjewel.", en: "Off to a fresh start — thank you." },
  { nl: "Fijne ochtend — bedankt dat je hierin duikt.", en: "Hope your morning's going well — thanks for diving in." },
];

const afternoon: Greeting[] = [
  { nl: "Goedemiddag — leuk dat je meedoet.", en: "Good afternoon — nice to have you." },
  { nl: "Goedemiddag! Bedankt dat je dit tussendoor doet.", en: "Good afternoon! Thanks for squeezing this in." },
  { nl: "Fijne middag — bedankt voor je tijd.", en: "Hope your afternoon's treating you well — thanks for the time." },
];

const evening: Greeting[] = [
  { nl: "Goedenavond — bedankt dat je nog even tijd maakt.", en: "Good evening — thanks for making time tonight." },
  { nl: "Een fijne avond — leuk dat je meedoet.", en: "Hope your evening's going well — nice to have you." },
];

const lateNight: Greeting[] = [
  { nl: "Nog wakker? Top — bedankt voor de tijd.", en: "Burning the midnight oil? Thanks for joining in." },
];

const monday: Greeting[] = [
  { nl: "Fijne maandag — bedankt voor de aftrap.", en: "Happy Monday — thanks for kicking things off." },
];

const wednesday: Greeting[] = [
  { nl: "Halverwege de week — bedankt dat je inhaakt.", en: "Halfway through the week — thanks for hopping in." },
];

const friday: Greeting[] = [
  { nl: "Fijne vrijdag — bedankt dat je hier nog even tijd voor maakt.", en: "Happy Friday — thanks for fitting this in." },
];

const weekend: Greeting[] = [
  { nl: "Fijn weekend — extra bedankt dat je de tijd neemt.", en: "Happy weekend — extra thanks for the time." },
];

function buildPool(now: Date): Greeting[] {
  const pool: Greeting[] = [...universal];
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun … 6=Sat

  if (hour >= 5 && hour < 12) pool.push(...morning);
  else if (hour >= 12 && hour < 18) pool.push(...afternoon);
  else if (hour >= 18 && hour < 22) pool.push(...evening);
  else pool.push(...lateNight);

  if (day === 1) pool.push(...monday);
  if (day === 3) pool.push(...wednesday);
  if (day === 5) pool.push(...friday);
  if (day === 0 || day === 6) pool.push(...weekend);

  return pool;
}

export function pickGreeting(now: Date = new Date()): Greeting {
  const pool = buildPool(now);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function renderGreeting(greeting: Greeting, locale: Locale): string {
  return greeting[locale];
}

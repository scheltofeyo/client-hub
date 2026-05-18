type Line = { nl: string; en: string };

export type Greeting = { welcome: Line; thanks: Line };

// Always eligible — used as a baseline pool so the rotation feels fresh
// regardless of when the survey is opened.
const universal: Greeting[] = [
  {
    welcome: { nl: "Hallo daar!", en: "Hello there!" },
    thanks: { nl: "Bedankt dat je meedoet.", en: "Thanks for joining in." },
  },
  {
    welcome: { nl: "Hoi!", en: "Hi there!" },
    thanks: { nl: "Fijn dat je tijd vrijmaakt.", en: "Glad you're making the time." },
  },
  {
    welcome: { nl: "Welkom!", en: "Welcome!" },
    thanks: { nl: "Bedankt dat je dit invult.", en: "Thanks for filling this in." },
  },
  {
    welcome: { nl: "Goed dat je er bent.", en: "Good to have you here." },
    thanks: { nl: "Bedankt voor je tijd.", en: "Thanks for your time." },
  },
  {
    welcome: { nl: "Fijn dat je hier bent.", en: "Glad you're here." },
    thanks: { nl: "Laten we beginnen.", en: "Let's get started." },
  },
  {
    welcome: { nl: "Top dat je meedoet!", en: "Great to have you!" },
    thanks: { nl: "Dat waarderen we enorm.", en: "We really appreciate it." },
  },
];

const morning: Greeting[] = [
  {
    welcome: { nl: "Goedemorgen!", en: "Good morning!" },
    thanks: { nl: "Fijn dat je er bent.", en: "Glad you're here." },
  },
  {
    welcome: { nl: "Goedemorgen!", en: "Good morning!" },
    thanks: { nl: "Bedankt dat je de tijd neemt.", en: "Thanks for taking the time." },
  },
  {
    welcome: { nl: "Een frisse start.", en: "Off to a fresh start." },
    thanks: { nl: "Dankjewel voor je tijd.", en: "Thank you for your time." },
  },
];

const afternoon: Greeting[] = [
  {
    welcome: { nl: "Goedemiddag!", en: "Good afternoon!" },
    thanks: { nl: "Leuk dat je meedoet.", en: "Nice to have you." },
  },
  {
    welcome: { nl: "Goedemiddag!", en: "Good afternoon!" },
    thanks: { nl: "Bedankt dat je dit tussendoor doet.", en: "Thanks for squeezing this in." },
  },
];

const evening: Greeting[] = [
  {
    welcome: { nl: "Goedenavond.", en: "Good evening." },
    thanks: { nl: "Bedankt dat je nog even tijd maakt.", en: "Thanks for making time tonight." },
  },
  {
    welcome: { nl: "Een fijne avond.", en: "Hope your evening's going well." },
    thanks: { nl: "Leuk dat je meedoet.", en: "Nice to have you." },
  },
];

const lateNight: Greeting[] = [
  {
    welcome: { nl: "Nog wakker?", en: "Burning the midnight oil?" },
    thanks: { nl: "Top — bedankt voor de tijd.", en: "Thanks for joining in." },
  },
];

const monday: Greeting[] = [
  {
    welcome: { nl: "Fijne maandag!", en: "Happy Monday!" },
    thanks: { nl: "Bedankt voor de aftrap.", en: "Thanks for kicking things off." },
  },
];

const wednesday: Greeting[] = [
  {
    welcome: { nl: "Halverwege de week!", en: "Halfway through the week!" },
    thanks: { nl: "Bedankt dat je inhaakt.", en: "Thanks for hopping in." },
  },
];

const friday: Greeting[] = [
  {
    welcome: { nl: "Fijne vrijdag!", en: "Happy Friday!" },
    thanks: {
      nl: "Bedankt dat je hier nog even tijd voor maakt.",
      en: "Thanks for fitting this in.",
    },
  },
];

const weekend: Greeting[] = [
  {
    welcome: { nl: "Fijn weekend!", en: "Happy weekend!" },
    thanks: { nl: "Extra bedankt dat je de tijd neemt.", en: "Extra thanks for the time." },
  },
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

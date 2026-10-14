// Instant, free triage: keyword rules in English, Hindi and Hinglish. Runs in the
// browser as residents type, and on the server to render guidance. No API calls.

import { CATEGORIES, type Category, type ProblemPath, type Severity, type Skill } from "./taxonomy";

export type Triage = {
  is_civic_problem: boolean;
  title: string;
  category: Category;
  severity: Severity;
  path: ProblemPath;
  skills_needed: Skill[];
};

// Latin keywords use \b word boundaries; Devanagari doesn't have JS word boundaries,
// so those patterns match anywhere. Ordered so dangerous matches win.
const KEYWORDS: [RegExp, Category][] = [
  [
    /\b(live|exposed|hanging|fallen|sparking|naked|loose)\b.*\bwires?\b|\bwires?\b.*\b(live|exposed|hanging|sparking|loose)\b|\b(shock|current|transformer|karant|taar)\b|\bgas (leak|smell)\b|\bopen manhole\b|करंट|तार|ट्रांसफ़ॉर्मर|ट्रांसफार्मर|गैस|खुला मैनहोल|बिजली का खंभा/i,
    "electrical",
  ],
  [/\b(garbage|trash|waste|dump|dumping|litter|kachra|kooda|kuda)\b|कचरा|कूड़ा|कूडा|गंदगी/i, "garbage"],
  [/\b(drain|gutter|clog|blocked|nala|naali|nali|sewage|waterlogg\w*)|नाली|नाला|गटर|सीवर|जलभराव/i, "drain"],
  [/\b(leak|leaking|pipe|tap|burst|paani|pani)\b|रिसाव|लीक|पाइप|नल|पानी बह/i, "water_leak"],
  [/\b(pothole|road|crater|asphalt|gaddha|gadda|sadak)\b|गड्ढा|गड्ढे|सड़क|सडक/i, "pothole"],
  [/\b(street ?lights?|lamp|dark street|batti)\b|स्ट्रीटलाइट|बत्ती|अंधेरा|लाइट/i, "streetlight"],
  [/\b(tree|branch|ped)\b|पेड़|पेड|डाल|डाली/i, "tree"],
  [/\b(footpath|sidewalk|pavement)\b|फ़ुटपाथ|फुटपाथ/i, "footpath"],
  [/\b(park|playground|garden)\b|पार्क|मैदान|बगीचा/i, "park"],
  [/\b(toilet|urinal|washroom|shauchalay)\b|शौचालय|टॉयलेट|पेशाबघर/i, "toilet"],
  [/\b(dog|cat|cow|animal|bird|puppy|kutta)\b|कुत्ता|कुत्ते|गाय|जानवर|पक्षी|बिल्ली/i, "animal"],
  [/\b(debris|construction|rubble|malba)\b|मलबा|निर्माण|ईंट|रेत/i, "construction"],
  [/\b(encroach\w*|blocked way|parked on footpath|kabza|kabja)\b|अतिक्रमण|कब्ज़ा|कब्जा|रास्ता बंद/i, "encroachment"],
  [/\b(noise|loud|smoke|burning|pollution)\b|शोर|धुआं|धुआँ|जलाना|प्रदूषण/i, "noise"],
  [/\b(traffic|signal|sign ?board|speed breaker|jam)\b|ट्रैफ़िक|ट्रैफिक|सिग्नल|ब्रेकर|जाम/i, "traffic"],
  [/\b(graffiti|vandal\w*|poster)\b|तोड़-फोड़|तोड़फोड़|पोस्टर/i, "vandalism"],
  [/\b(bench|gate|railing|fence)\b|बेंच|गेट|रेलिंग|बाड़/i, "fixture"],
];

const URGENT = /\b(accident|injur\w*|hurt|child(ren)?|school|hospital|urgent|elderly|night|rain|flood\w*)\b|दुर्घटना|चोट|बच्चे|स्कूल|अस्पताल|ज़रूरी|जरूरी|बुज़ुर्ग|बारिश|बाढ़/i;
const NOT_CIVIC = /\b(my (wife|husband|neighbou?r's|landlord) (is|said)|rent dispute|personal|selfie)\b/i;

const CATEGORY_SKILLS: Partial<Record<Category, Skill[]>> = {
  garbage: ["gardening", "labor"],
  drain: ["labor"],
  water_leak: ["general"],
  tree: ["labor", "transport"],
  park: ["gardening"],
  animal: ["animal_care"],
  fixture: ["labor"],
  streetlight: ["writing"],
  pothole: ["writing"],
  footpath: ["writing"],
  traffic: ["writing", "media"],
  construction: ["writing"],
};

export function triage(description: string): Triage {
  const text = description.trim();
  const category = KEYWORDS.find(([re]) => re.test(text))?.[1] ?? "other";
  const path = CATEGORIES[category].path;
  const firstLine = text.split(/[.\n।]/)[0]?.trim() ?? "";
  const severity: Severity = path === "danger" ? "critical" : URGENT.test(text) ? "high" : "medium";
  return {
    is_civic_problem: !NOT_CIVIC.test(text),
    title: firstLine.slice(0, 70),
    category,
    severity,
    path,
    skills_needed: path === "danger" ? [] : (CATEGORY_SKILLS[category] ?? []),
  };
}

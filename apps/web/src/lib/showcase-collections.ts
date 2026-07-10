export type ShowcaseCollection = {
  id: string;
  title: string;
  occasion: string;
  recipient: string;
  storyPreview: string;
  meaningPreview: string;
  crestSrc: string;
  tags: string[];
};

export const showcaseCollections: ShowcaseCollection[] = [
  {
    id: "01-father-retirement",
    title: "Father Retirement",
    occasion: "Retirement",
    recipient: "Father",
    storyPreview:
      "A tribute to a father whose love was shown through steady work, protection, sacrifice, and integrity.",
    meaningPreview:
      "Classic shield, tree, roots, and laurel frame a life of responsibility and quiet family protection.",
    crestSrc: "/assets/showcase-collections/01-father-retirement/final-crest.png",
    tags: ["Father", "Retirement"]
  },
  {
    id: "02-mother-birthday",
    title: "Mother Birthday",
    occasion: "60th Birthday",
    recipient: "Mother",
    storyPreview:
      "A birthday collection honoring the person who held the family together with love, kindness, and strength.",
    meaningPreview:
      "A resilient mountain path and warm gold details express care that stayed steady across seasons.",
    crestSrc: "/assets/showcase-collections/02-mother-birthday/final-crest.png",
    tags: ["Mother", "Birthday"]
  },
  {
    id: "03-wedding-gift",
    title: "Wedding Gift",
    occasion: "Wedding",
    recipient: "Newly Married Couple",
    storyPreview:
      "A beginning-of-family collection for two people stepping into a shared future together.",
    meaningPreview:
      "Compass and medallion language point toward unity, faith, future, and the road ahead.",
    crestSrc: "/assets/showcase-collections/03-wedding-gift/final-crest.png",
    tags: ["Wedding"]
  },
  {
    id: "04-anniversary",
    title: "Anniversary",
    occasion: "Anniversary",
    recipient: "The Couple",
    storyPreview:
      "A keepsake for honoring a life built together through patience, humor, loyalty, and shared care.",
    meaningPreview:
      "Shield, roots, and botanical detail make commitment feel protected, recognized, and lasting.",
    crestSrc: "/assets/showcase-collections/04-anniversary/final-crest.png",
    tags: ["Anniversary"]
  },
  {
    id: "05-christmas-family",
    title: "Christmas Family",
    occasion: "Christmas",
    recipient: "Whole Family",
    storyPreview:
      "A holiday collection made for gathering, gratitude, tradition, and the stories families retell together.",
    meaningPreview:
      "Mountain, path, and laurel create a shared family emblem for gratitude, joy, and continuity.",
    crestSrc: "/assets/showcase-collections/05-christmas-family/final-crest.png",
    tags: ["Christmas", "Family"]
  },
  {
    id: "06-grandfather-legacy",
    title: "Grandfather Legacy",
    occasion: "Legacy Gift",
    recipient: "Grandfather",
    storyPreview:
      "A legacy collection honoring a grandfather who immigrated with little and built a new life.",
    meaningPreview:
      "A lantern within an archival frame carries memory, guidance, resilience, and hope forward.",
    crestSrc: "/assets/showcase-collections/06-grandfather-legacy/final-crest.png",
    tags: ["Grandfather", "Retirement"]
  },
  {
    id: "07-grandmother-birthday",
    title: "Grandmother Birthday",
    occasion: "80th Birthday",
    recipient: "Grandmother",
    storyPreview:
      "A birthday keepsake for the grandmother who kept family stories alive across generations.",
    meaningPreview:
      "Gothic lantern and archive language turn memory, love, and wisdom into a private family emblem.",
    crestSrc: "/assets/showcase-collections/07-grandmother-birthday/final-crest.png",
    tags: ["Grandmother", "Birthday"]
  },
  {
    id: "08-graduation",
    title: "Graduation",
    occasion: "Graduation",
    recipient: "Daughter",
    storyPreview:
      "A proud graduation collection for someone stepping forward as the first in the family to graduate.",
    meaningPreview:
      "Compass direction and gold medallion structure express courage, hope, and future movement.",
    crestSrc: "/assets/showcase-collections/08-graduation/final-crest.png",
    tags: ["Graduation"]
  },
  {
    id: "09-military-retirement",
    title: "Military Retirement",
    occasion: "Military Retirement",
    recipient: "Father",
    storyPreview:
      "A retirement collection honoring discipline, courage, service, and the steadiness brought home.",
    meaningPreview:
      "Classic shield structure gives protection and honor a calm family-centered expression.",
    crestSrc: "/assets/showcase-collections/09-military-retirement/final-crest.png",
    tags: ["Father", "Retirement"]
  },
  {
    id: "10-new-baby",
    title: "New Baby",
    occasion: "New Baby",
    recipient: "Baby Amelia",
    storyPreview:
      "A welcoming collection for the beginning of a new family chapter filled with love and hope.",
    meaningPreview:
      "Compass and star language make the future feel bright, protected, and gently guided.",
    crestSrc: "/assets/showcase-collections/10-new-baby/final-crest.png",
    tags: ["Family"]
  },
  {
    id: "11-family-reunion",
    title: "Family Reunion",
    occasion: "Family Reunion",
    recipient: "Whole Family",
    storyPreview:
      "A reunion collection for relatives coming together again after years apart.",
    meaningPreview:
      "Mountain resilience and family path details express roots, gratitude, and togetherness.",
    crestSrc: "/assets/showcase-collections/11-family-reunion/final-crest.png",
    tags: ["Family"]
  },
  {
    id: "12-memorial",
    title: "Memorial Keepsake",
    occasion: "Memorial",
    recipient: "Grandmother",
    storyPreview:
      "A remembrance collection for a grandmother whose kindness and light remain with the family.",
    meaningPreview:
      "Lantern, arch, and gold ornament preserve memory without turning grief into spectacle.",
    crestSrc: "/assets/showcase-collections/12-memorial/final-crest.png",
    tags: ["Grandmother"]
  },
  {
    id: "13-fathers-day",
    title: "Father's Day",
    occasion: "Father's Day",
    recipient: "Dad",
    storyPreview:
      "A Father's Day collection for the dad whose love showed up through quiet work and daily care.",
    meaningPreview:
      "Shield, tree, and roots recognize protection, gratitude, and sacrifice with dignity.",
    crestSrc: "/assets/showcase-collections/13-fathers-day/final-crest.png",
    tags: ["Father"]
  },
  {
    id: "14-mothers-day",
    title: "Mother's Day",
    occasion: "Mother's Day",
    recipient: "Mom",
    storyPreview:
      "A Mother's Day collection for the person who made everyone feel safe, fed, heard, and loved.",
    meaningPreview:
      "Mountain, branch, and gold detail frame love, home, and strength as a keepsake.",
    crestSrc: "/assets/showcase-collections/14-mothers-day/final-crest.png",
    tags: ["Mother"]
  },
  {
    id: "15-retirement-teacher",
    title: "Teacher Retirement",
    occasion: "Retirement",
    recipient: "Mrs. Carter",
    storyPreview:
      "A retirement collection for a teacher who guided generations with patience and care.",
    meaningPreview:
      "Lantern and archive framing make wisdom, guidance, and legacy feel preserved.",
    crestSrc: "/assets/showcase-collections/15-retirement-teacher/final-crest.png",
    tags: ["Retirement"]
  },
  {
    id: "16-housewarming",
    title: "Housewarming",
    occasion: "Housewarming",
    recipient: "The Rivera Family",
    storyPreview:
      "A home-centered collection for a family starting again after a difficult season.",
    meaningPreview:
      "Mountain and path symbolism give resilience, home, and hope a grounded visual language.",
    crestSrc: "/assets/showcase-collections/16-housewarming/final-crest.png",
    tags: ["Family"]
  },
  {
    id: "17-adoption-day",
    title: "Adoption Day",
    occasion: "Adoption Day",
    recipient: "Eli",
    storyPreview:
      "A family belonging collection for the day love and waiting became official.",
    meaningPreview:
      "Lantern, arch, and gold ornament carry guidance, belonging, love, and future hope.",
    crestSrc: "/assets/showcase-collections/17-adoption-day/final-crest.png",
    tags: ["Family"]
  },
  {
    id: "18-immigration-anniversary",
    title: "Immigration Anniversary",
    occasion: "Immigration Anniversary",
    recipient: "The Nguyen Family",
    storyPreview:
      "A journey collection for a family that crossed oceans and built a home in a new country.",
    meaningPreview:
      "Compass, ring, and star language express journey, resilience, direction, and legacy.",
    crestSrc: "/assets/showcase-collections/18-immigration-anniversary/final-crest.png",
    tags: ["Family"]
  },
  {
    id: "19-business-founder",
    title: "Founder Tribute",
    occasion: "Business Retirement",
    recipient: "Uncle Robert",
    storyPreview:
      "A tribute collection for someone who built a family business with his hands and his word.",
    meaningPreview:
      "Classic shield and rooted tree structure honor craftsmanship, integrity, and legacy.",
    crestSrc: "/assets/showcase-collections/19-business-founder/final-crest.png",
    tags: ["Retirement"]
  },
  {
    id: "20-parents-anniversary",
    title: "Parents Anniversary",
    occasion: "50th Anniversary",
    recipient: "Mom and Dad",
    storyPreview:
      "An anniversary collection for parents who held the family together through every season.",
    meaningPreview:
      "Shield, tree, roots, and botanical support make unity, love, and legacy visible.",
    crestSrc: "/assets/showcase-collections/20-parents-anniversary/final-crest.png",
    tags: ["Mother", "Father", "Anniversary"]
  }
];

export const showcaseFilters = [
  "Father",
  "Mother",
  "Grandfather",
  "Wedding",
  "Retirement",
  "Christmas"
] as const;

export function getShowcaseCollection(id: string): ShowcaseCollection | undefined {
  return showcaseCollections.find((collection) => collection.id === id);
}

export type ShowcaseSeoDetail = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  buyerNeed: string;
  recipientDetail: string;
  personalizationFocus: string[];
  relatedIds: string[];
  giftPath: string;
  giftLabel: string;
};

export const showcaseSeoDetails: Record<string, ShowcaseSeoDetail> = {
  "01-father-retirement": {
    seoTitle: "Retirement Gift for Father: Quiet Strength Keepsake",
    seoDescription:
      "See a personalized retirement gift for a father whose protection, integrity, and sacrifice shaped his family, with a symbolic crest and story.",
    h1: "A retirement legacy collection for a father's quiet strength",
    buyerNeed:
      "This example is for a family trying to honor decades of work without reducing a father's life to a job title or retirement date.",
    recipientDetail:
      "Protection, sacrifice, and integrity guide the shield, rooted tree, restrained laurel, and the language used throughout the collection.",
    personalizationFocus: ["Years of steady work", "Family protection", "Integrity taught by example"],
    relatedIds: ["09-military-retirement", "19-business-founder", "13-fathers-day"],
    giftPath: "/gifts/father-retirement",
    giftLabel: "retirement gifts for fathers"
  },
  "02-mother-birthday": {
    seoTitle: "Meaningful 60th Birthday Gift for Mother: Legacy Collection",
    seoDescription:
      "Explore a meaningful 60th birthday gift for a mother whose love, kindness, and strength held her family together across the years.",
    h1: "A 60th birthday collection for the mother who held everyone together",
    buyerNeed:
      "This example shows how a milestone birthday can recognize a mother's emotional contribution rather than simply marking her age.",
    recipientDetail:
      "Warm gold, an enduring mountain path, and steady botanical details reflect care that remained strong through changing family seasons.",
    personalizationFocus: ["Milestone birthday", "Love expressed through care", "Strength across family seasons"],
    relatedIds: ["14-mothers-day", "07-grandmother-birthday", "20-parents-anniversary"],
    giftPath: "/gifts/mother-birthday",
    giftLabel: "meaningful birthday gifts for mothers"
  },
  "03-wedding-gift": {
    seoTitle: "Personalized Wedding Legacy Gift for a New Family",
    seoDescription:
      "View a personalized wedding legacy gift shaped around unity, faith, future, and the shared direction of a newly married couple.",
    h1: "A wedding collection for two people beginning a family together",
    buyerNeed:
      "This example is for a gift buyer who wants to honor the couple's future, not add another interchangeable object to the registry table.",
    recipientDetail:
      "A compass-led medallion makes shared direction primary, while unity and future remain supporting meanings rather than generic wedding decoration.",
    personalizationFocus: ["Two equal recipients", "Shared direction", "Values for the home they are building"],
    relatedIds: ["04-anniversary", "10-new-baby", "20-parents-anniversary"],
    giftPath: "/gifts/wedding",
    giftLabel: "personalized wedding legacy gifts"
  },
  "04-anniversary": {
    seoTitle: "Personalized Anniversary Keepsake for a Life Built Together",
    seoDescription:
      "See an anniversary legacy collection honoring patience, humor, loyalty, and the family life a couple built through years of shared care.",
    h1: "An anniversary keepsake for the life they built together",
    buyerNeed:
      "This example helps adult children or partners celebrate the substance of a relationship, not only the number of years on a calendar.",
    recipientDetail:
      "Shield, roots, and botanical support express commitment as something protected, lived, and continually renewed.",
    personalizationFocus: ["Shared history", "Commitment through ordinary seasons", "A couple-centered recipient voice"],
    relatedIds: ["20-parents-anniversary", "03-wedding-gift", "18-immigration-anniversary"],
    giftPath: "/gifts/anniversary",
    giftLabel: "personalized anniversary gifts"
  },
  "05-christmas-family": {
    seoTitle: "Personalized Christmas Gift for the Whole Family",
    seoDescription:
      "Browse a personalized Christmas family gift shaped by gratitude, shared traditions, joy, and the stories generations return to together.",
    h1: "A Christmas legacy collection for the whole family",
    buyerNeed:
      "This example replaces several short-lived household gifts with one shared keepsake the family can open and discuss together.",
    recipientDetail:
      "Mountain, path, and laurel details emphasize gathering, continuity, and gratitude without turning the crest into seasonal decoration.",
    personalizationFocus: ["Whole-family language", "Holiday traditions", "Gratitude across generations"],
    relatedIds: ["11-family-reunion", "20-parents-anniversary", "07-grandmother-birthday"],
    giftPath: "/gifts/christmas-family",
    giftLabel: "personalized Christmas family gifts"
  },
  "06-grandfather-legacy": {
    seoTitle: "Personalized Legacy Gift for Grandfather: Migration and Hope",
    seoDescription:
      "See a legacy gift for a grandfather who immigrated with little and built a new life, expressed through memory, guidance, resilience, and hope.",
    h1: "A grandfather legacy collection shaped by migration and hope",
    buyerNeed:
      "This example preserves a migration story without inventing genealogy, titles, or a romanticized family history the evidence does not support.",
    recipientDetail:
      "The lantern leads as a sign of remembered guidance, while the archive frame gives his lived experience a dignified place in the family record.",
    personalizationFocus: ["Migration evidence", "Guidance remembered by descendants", "A hopeful legacy ending"],
    relatedIds: ["18-immigration-anniversary", "07-grandmother-birthday", "12-memorial"],
    giftPath: "/gifts/grandparents",
    giftLabel: "personalized gifts for grandparents"
  },
  "07-grandmother-birthday": {
    seoTitle: "80th Birthday Gift for Grandmother: Memory Keepsake",
    seoDescription:
      "Explore an 80th birthday gift for a grandmother who kept family stories alive through love, wisdom, and the memories she shared.",
    h1: "An 80th birthday collection for the keeper of family stories",
    buyerNeed:
      "This example gives grandchildren a way to recognize the person who carried stories, traditions, and emotional continuity across generations.",
    recipientDetail:
      "A Gothic memory lantern and archive frame place remembrance and wisdom at the center while keeping the tone warm and hopeful.",
    personalizationFocus: ["80th birthday milestone", "Stories kept alive", "Wisdom shared through family memory"],
    relatedIds: ["06-grandfather-legacy", "02-mother-birthday", "12-memorial"],
    giftPath: "/gifts/grandparents",
    giftLabel: "personalized gifts for grandparents"
  },
  "08-graduation": {
    seoTitle: "Personalized Graduation Keepsake for a Family First",
    seoDescription:
      "View a graduation legacy collection for a daughter becoming the first in her family to graduate, with symbols of courage, hope, and direction.",
    h1: "A graduation keepsake for a daughter carrying the family forward",
    buyerNeed:
      "This example marks academic achievement while recognizing the family roots, courage, and future responsibility behind the milestone.",
    recipientDetail:
      "Compass direction and a restrained gold medallion make forward movement primary without treating education as status or inherited prestige.",
    personalizationFocus: ["First-generation achievement", "Courage", "Future direction grounded in family roots"],
    relatedIds: ["10-new-baby", "15-retirement-teacher", "18-immigration-anniversary"],
    giftPath: "/gifts/family-reunion",
    giftLabel: "family keepsake gifts"
  },
  "09-military-retirement": {
    seoTitle: "Military Retirement Gift for Father: Service Keepsake",
    seoDescription:
      "See a military retirement gift honoring a father's discipline, courage, service, and the steadiness he brought home to his family.",
    h1: "A military retirement collection centered on service brought home",
    buyerNeed:
      "This example recognizes service without aggressive imagery, rank inflation, or official military and heraldic claims.",
    recipientDetail:
      "The classic shield expresses protection, while quieter rooted details keep the emotional focus on family rather than ceremony or authority.",
    personalizationFocus: ["Service", "Discipline", "Protection expressed in family life"],
    relatedIds: ["01-father-retirement", "19-business-founder", "13-fathers-day"],
    giftPath: "/gifts/father-retirement",
    giftLabel: "retirement gifts for fathers"
  },
  "10-new-baby": {
    seoTitle: "New Baby Family Legacy Gift: A Keepsake for the Beginning",
    seoDescription:
      "See a new baby legacy collection welcoming Amelia with love, hope, protection, and a symbolic keepsake for the story just beginning.",
    h1: "A new baby collection for the beginning of a family chapter",
    buyerNeed:
      "This example gives parents a future-facing keepsake that can remain meaningful after newborn gifts have been outgrown.",
    recipientDetail:
      "Compass and guiding star language express hope and protection while leaving space for the child to grow into a story not yet written.",
    personalizationFocus: ["A named child", "New beginning", "Hope without invented future claims"],
    relatedIds: ["03-wedding-gift", "17-adoption-day", "08-graduation"],
    giftPath: "/gifts/wedding",
    giftLabel: "new family keepsakes"
  },
  "11-family-reunion": {
    seoTitle: "Personalized Family Reunion Gift for Generations Together",
    seoDescription:
      "Explore a personalized family reunion gift built around shared roots, gratitude, resilience, and the meaning of gathering again after years apart.",
    h1: "A family reunion keepsake for the stories that bring everyone back",
    buyerNeed:
      "This example creates one meaningful focal gift for relatives reconnecting, instead of another favor that disappears after the gathering.",
    recipientDetail:
      "Mountain resilience and a shared path express distance overcome, while whole-family language avoids assigning one person's pronouns to everyone.",
    personalizationFocus: ["Collective recipient", "Reconnection after time apart", "Shared roots and gratitude"],
    relatedIds: ["05-christmas-family", "18-immigration-anniversary", "20-parents-anniversary"],
    giftPath: "/gifts/family-reunion",
    giftLabel: "personalized family reunion gifts"
  },
  "12-memorial": {
    seoTitle: "Personalized Memorial Keepsake for Grandmother",
    seoDescription:
      "View a dignified memorial keepsake for a grandmother whose kindness and guidance remain with the family, ending remembrance with hope.",
    h1: "A remembrance collection for a grandmother whose light remains",
    buyerNeed:
      "This example supports a family that wants to preserve memory without turning grief into spectacle or claiming details that were never supplied.",
    recipientDetail:
      "The lantern holds remembrance at the center, the arch provides quiet structure, and the closing language returns the family gently to hope.",
    personalizationFocus: ["A specific remembered kindness", "Dignified grief", "Hope carried forward"],
    relatedIds: ["07-grandmother-birthday", "06-grandfather-legacy", "17-adoption-day"],
    giftPath: "/gifts/grandparents",
    giftLabel: "family remembrance keepsakes"
  },
  "13-fathers-day": {
    seoTitle: "Meaningful Father's Day Gift for a Dad Who Asks for Nothing",
    seoDescription:
      "See a meaningful Father's Day gift shaped by a dad's quiet work, protection, gratitude, and everyday care for his family.",
    h1: "A Father's Day collection for the dad who never asks for much",
    buyerNeed:
      "This example helps a family say what a short Father's Day card cannot: that ordinary acts of care became part of the family's foundation.",
    recipientDetail:
      "Shield, tree, and roots make protection and gratitude visible while the story remains grounded in daily care rather than exaggerated praise.",
    personalizationFocus: ["Daily care", "Quiet work", "Gratitude expressed by the family"],
    relatedIds: ["01-father-retirement", "09-military-retirement", "19-business-founder"],
    giftPath: "/gifts/fathers-day",
    giftLabel: "meaningful Father's Day gifts"
  },
  "14-mothers-day": {
    seoTitle: "Meaningful Mother's Day Gift for the Heart of the Family",
    seoDescription:
      "View a Mother's Day legacy collection for the person who made the family feel safe, fed, heard, and loved through everyday care.",
    h1: "A Mother's Day keepsake for the person who made home feel safe",
    buyerNeed:
      "This example recognizes the emotional labor that ordinary gifts often leave unnamed, using one real family role as the center of the collection.",
    recipientDetail:
      "Mountain, branch, and warm gold details frame love and home as steady strengths rather than decorative sentiment.",
    personalizationFocus: ["Emotional safety", "Care in ordinary moments", "Love expressed through action"],
    relatedIds: ["02-mother-birthday", "07-grandmother-birthday", "20-parents-anniversary"],
    giftPath: "/gifts/mother-birthday",
    giftLabel: "meaningful gifts for mothers"
  },
  "15-retirement-teacher": {
    seoTitle: "Teacher Retirement Legacy Gift for a Life of Guidance",
    seoDescription:
      "Explore a teacher retirement legacy gift honoring patience, wisdom, guidance, and the generations shaped by a long classroom career.",
    h1: "A retirement collection for a teacher who guided generations",
    buyerNeed:
      "This example gives colleagues or family a way to honor a teaching life without reducing it to a plaque of dates and job titles.",
    recipientDetail:
      "Lantern and archive framing preserve guidance and wisdom, while the story focuses on patience and care rather than institutional prestige.",
    personalizationFocus: ["Teaching contribution", "Guidance", "Generations influenced"],
    relatedIds: ["08-graduation", "19-business-founder", "01-father-retirement"],
    giftPath: "/gifts/father-retirement",
    giftLabel: "personalized retirement keepsakes"
  },
  "16-housewarming": {
    seoTitle: "Personalized Housewarming Keepsake for a New Family Chapter",
    seoDescription:
      "See a family housewarming keepsake centered on resilience, home, and hope after a difficult season and a meaningful new beginning.",
    h1: "A housewarming collection for a family starting again",
    buyerNeed:
      "This example honors the emotional meaning of a new home, especially when reaching it required resilience rather than a simple change of address.",
    recipientDetail:
      "Mountain and path symbolism acknowledge hardship and movement while keeping the new home, not the struggle, as the hopeful destination.",
    personalizationFocus: ["A new home", "Resilience after hardship", "Hopeful beginning"],
    relatedIds: ["18-immigration-anniversary", "17-adoption-day", "11-family-reunion"],
    giftPath: "/gifts/family-reunion",
    giftLabel: "family keepsake gifts"
  },
  "17-adoption-day": {
    seoTitle: "Personalized Adoption Day Keepsake for Family Belonging",
    seoDescription:
      "View an adoption day legacy collection shaped around belonging, love, waiting, guidance, and the hopeful future of a family made official.",
    h1: "An adoption day collection for the moment love became family",
    buyerNeed:
      "This example centers belonging without inventing a past or speaking for experiences the family did not provide.",
    recipientDetail:
      "Lantern, arch, and gold ornament express guidance and welcome, while the story keeps love and future hope ahead of ceremony.",
    personalizationFocus: ["Belonging", "A named family milestone", "Hopeful future without invented history"],
    relatedIds: ["10-new-baby", "16-housewarming", "03-wedding-gift"],
    giftPath: "/gifts/wedding",
    giftLabel: "new family keepsakes"
  },
  "18-immigration-anniversary": {
    seoTitle: "Immigration Anniversary Legacy Gift for a Family Journey",
    seoDescription:
      "Explore a family legacy gift honoring the Nguyen family's journey across oceans, resilience, new home, direction, and future generations.",
    h1: "An immigration anniversary collection for a journey that became home",
    buyerNeed:
      "This example recognizes migration through supplied family evidence and never substitutes generic ancestry claims for a lived journey.",
    recipientDetail:
      "Compass, ring, and star place journey and direction first, with home and legacy as the meanings reached through that movement.",
    personalizationFocus: ["A real migration journey", "New home", "Direction and future generations"],
    relatedIds: ["06-grandfather-legacy", "11-family-reunion", "16-housewarming"],
    giftPath: "/gifts/family-reunion",
    giftLabel: "family journey keepsakes"
  },
  "19-business-founder": {
    seoTitle: "Business Founder Retirement Gift: Legacy Keepsake",
    seoDescription:
      "See a retirement tribute for a family business founder whose craftsmanship, integrity, and word created a legacy others can continue.",
    h1: "A founder tribute for a family business built by hand and word",
    buyerNeed:
      "This example honors the person behind a family business without making corporate status or wealth the measure of his legacy.",
    recipientDetail:
      "A classic shield and rooted tree support craftsmanship and integrity, with family continuity more prominent than commercial success.",
    personalizationFocus: ["Craftsmanship", "A family business", "Integrity and continuity"],
    relatedIds: ["01-father-retirement", "09-military-retirement", "15-retirement-teacher"],
    giftPath: "/gifts/father-retirement",
    giftLabel: "retirement gifts for family founders"
  },
  "20-parents-anniversary": {
    seoTitle: "50th Anniversary Legacy Gift for Parents",
    seoDescription:
      "View a 50th anniversary legacy gift for parents whose unity, love, and endurance held the family together through every season.",
    h1: "A 50th anniversary collection for the parents who held the family together",
    buyerNeed:
      "This example gives adult children a way to recognize both parents equally and connect the anniversary milestone to the family it made possible.",
    recipientDetail:
      "Shield, tree, roots, and botanical support make unity and continuity visible without repeating certificate language inside the story or meaning guide.",
    personalizationFocus: ["Two equal recipients", "50 years together", "Love, unity, and family continuity"],
    relatedIds: ["04-anniversary", "03-wedding-gift", "05-christmas-family"],
    giftPath: "/gifts/anniversary",
    giftLabel: "anniversary gifts for parents"
  }
};

export function getShowcaseSeoDetail(id: string): ShowcaseSeoDetail {
  const detail = showcaseSeoDetails[id];
  if (!detail) {
    throw new Error(`Missing showcase SEO detail for ${id}`);
  }
  return detail;
}

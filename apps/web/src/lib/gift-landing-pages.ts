export type GiftLandingPageSpec = {
  slug: string;
  primaryKeyword: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  buyerProblemTitle: string;
  buyerProblem: string;
  recipientFit: string;
  personalization: string[];
  exampleIds: string[];
  deliveryNote: string;
  faq: Array<{ question: string; answer: string }>;
  relatedSlugs: string[];
};

export const giftLandingPages: GiftLandingPageSpec[] = [
  {
    slug: "father-retirement",
    primaryKeyword: "retirement gift for father",
    title: "Retirement Gift for Father | Personalized Legacy Keepsake",
    description:
      "Honor Dad's work, sacrifice, and example with a personalized retirement gift: a frameable certificate, final crest, family story, and private collection.",
    eyebrow: "Retirement gift for father",
    h1: "A retirement gift that honors everything Dad carried for the family.",
    lead:
      "Retirement deserves more than another watch or bottle. MyKinLegacy turns the years he worked, the values he lived, and the family he protected into a private digital keepsake made for presentation and preservation.",
    buyerProblemTitle: "For the father who says he does not need anything",
    buyerProblem:
      "The hardest retirement gifts are for fathers whose contribution was steady rather than showy. This collection gives the family a dignified way to name his work, sacrifice, integrity, and influence without exaggerating his history.",
    recipientFit:
      "Best for a father, stepfather, grandfather, mentor, or family provider whose retirement marks a meaningful transition.",
    personalization: [
      "His occupation, years of service, and the contribution the family remembers",
      "Values such as protection, integrity, sacrifice, craftsmanship, or guidance",
      "A specific memory that shows how he cared for others",
      "A visual direction chosen to support his story rather than claim official heraldry"
    ],
    exampleIds: ["01-father-retirement", "09-military-retirement", "19-business-founder"],
    deliveryNote:
      "Founder Edition collections are reviewed before release and normally delivered digitally within two business days through a private vault.",
    faq: [
      {
        question: "What makes this different from a standard retirement gift?",
        answer:
          "It is built from the recipient's real contribution, values, and family memories, then assembled as one personal legacy collection."
      },
      {
        question: "Can the certificate be printed and framed?",
        answer:
          "Yes. The Family Legacy Certificate is the primary frameable keepsake, with the Final Crest supplied separately for personal printing."
      },
      {
        question: "Is the crest an official coat of arms?",
        answer:
          "No. It is a personalized symbolic keepsake and does not claim legal heraldry, noble status, or certified genealogy."
      }
    ],
    relatedSlugs: ["fathers-day", "grandparents", "family-reunion"]
  },
  {
    slug: "fathers-day",
    primaryKeyword: "meaningful Father's Day gift",
    title: "Meaningful Father's Day Gift | Personalized Family Keepsake",
    description:
      "Create a meaningful Father's Day gift shaped by Dad's values, quiet care, and place in the family, with a final crest and frameable certificate.",
    eyebrow: "Meaningful Father's Day gift",
    h1: "Give Dad a Father's Day gift that recognizes who he is to the family.",
    lead:
      "For the father who rarely asks for anything, a useful gift can still feel ordinary. This collection centers the protection, humor, patience, work, or everyday care that made him matter.",
    buyerProblemTitle: "Say more than a card can hold",
    buyerProblem:
      "Father's Day often reduces a lifetime of care to a short message. MyKinLegacy gives that message a lasting form through one Final Crest, a frameable certificate, a Family Story, and the meaning behind the design.",
    recipientFit:
      "Designed for dads, stepdads, grandfathers, and father figures whose influence is better shown through real memories than generic praise.",
    personalization: [
      "The name or relationship the family naturally uses for him",
      "The daily actions that made the family feel protected or supported",
      "Values he taught through example",
      "An occasion-aware dedication that feels appropriate for Father's Day"
    ],
    exampleIds: ["13-fathers-day", "01-father-retirement", "20-parents-anniversary"],
    deliveryNote:
      "This is a digital personalized collection. Founder review happens before the private vault is released, so ordering ahead is recommended.",
    faq: [
      {
        question: "What if Dad is difficult to write about?",
        answer:
          "The guided questions focus on specific actions, values, and memories, so you do not need to arrive with a polished story."
      },
      {
        question: "Can this be a gift from the whole family?",
        answer:
          "Yes. The story and dedication can recognize shared family gratitude rather than a single buyer's voice."
      },
      {
        question: "Is anything shipped physically?",
        answer:
          "No. Founder Edition delivery is digital through a private vault, with files prepared for personal printing and keeping."
      }
    ],
    relatedSlugs: ["father-retirement", "grandparents", "christmas-family"]
  },
  {
    slug: "mother-birthday",
    primaryKeyword: "meaningful birthday gift for mother",
    title: "Birthday Gift for Mother | Personalized Family Keepsake",
    description:
      "Celebrate Mom with a personalized birthday keepsake built around her love, strength, memories, and the family she has held together.",
    eyebrow: "Birthday gift for mother",
    h1: "A birthday gift that lets Mom see what her care has meant.",
    lead:
      "Milestone birthdays invite the family to look back with gratitude. This private collection turns the qualities people rely on in her into a frameable certificate, a symbolic crest, and a story she can return to.",
    buyerProblemTitle: "For a life that cannot be summarized by another present",
    buyerProblem:
      "When a mother has spent years holding people together, ordinary birthday gifts can feel disconnected from what the family truly wants to say. This collection makes her contribution the center of the gift.",
    recipientFit:
      "Especially suited to milestone birthdays for mothers, grandmothers, stepmothers, and maternal figures who shaped the emotional life of a family.",
    personalization: [
      "Her milestone and the family role being honored",
      "Memories that reveal kindness, steadiness, humor, or strength",
      "Values such as love, resilience, wisdom, home, or unity",
      "Symbols and language that remain warm without becoming sentimental or generic"
    ],
    exampleIds: ["02-mother-birthday", "14-mothers-day", "07-grandmother-birthday"],
    deliveryNote:
      "The finished collection is delivered digitally after Founder review, normally within two business days, with no physical shipping.",
    faq: [
      {
        question: "Can the birthday age appear in the collection?",
        answer:
          "Yes, when supplied, the milestone can shape the occasion wording without turning the certificate into a generic birthday card."
      },
      {
        question: "Will the story sound overly sentimental?",
        answer:
          "The writing is grounded in the memories and values you provide, with a warm but restrained Legacy Curator voice."
      },
      {
        question: "Can Mom print the certificate?",
        answer:
          "Yes. The primary certificate is designed as a personal, frameable keepsake."
      }
    ],
    relatedSlugs: ["grandparents", "anniversary", "christmas-family"]
  },
  {
    slug: "grandparents",
    primaryKeyword: "personalized gift for grandparents",
    title: "Personalized Gift for Grandparents | Family Legacy Keepsake",
    description:
      "Create a personalized gift for grandparents that preserves their guidance, memories, values, and place in the family as a private legacy collection.",
    eyebrow: "Personalized gift for grandparents",
    h1: "Preserve the stories and values your grandparents gave the family.",
    lead:
      "Grandparents often value recognition more than more belongings. A Family Legacy Collection honors the memories they kept, the guidance they offered, and what younger generations will carry forward.",
    buyerProblemTitle: "A gift for people whose real legacy is already living in the family",
    buyerProblem:
      "Photo gifts can preserve faces while leaving the deeper story unspoken. This collection connects a real memory to a symbolic Final Crest, a Family Story, and a frameable certificate made for the recipient.",
    recipientFit:
      "For a grandfather, grandmother, grandparent couple, or elder whose migration, work, wisdom, faith, care, or family traditions deserve to be named.",
    personalization: [
      "A memory the family wants future generations to know",
      "Guidance, traditions, sayings, or values associated with the grandparent",
      "A birthday, anniversary, Christmas, reunion, retirement, or remembrance context",
      "Hopeful language that preserves memory without inventing family history"
    ],
    exampleIds: ["06-grandfather-legacy", "07-grandmother-birthday", "12-memorial"],
    deliveryNote:
      "The collection is private by default and delivered digitally after Founder review. Family members can print the keepsakes for personal use.",
    faq: [
      {
        question: "Do we need detailed genealogy records?",
        answer:
          "No. MyKinLegacy works from the memories, values, and family evidence you choose to share and does not certify genealogy."
      },
      {
        question: "Can siblings contribute to the same gift?",
        answer:
          "Yes. You can gather one or two meaningful memories and shared values before completing the guided interview."
      },
      {
        question: "Is a memorial collection handled differently?",
        answer:
          "Remembrance language stays grounded, dignified, and hopeful, without making unsupported claims about the person's life."
      }
    ],
    relatedSlugs: ["father-retirement", "mother-birthday", "family-reunion"]
  },
  {
    slug: "wedding",
    primaryKeyword: "personalized family gift for wedding",
    title: "Personalized Wedding Legacy Gift | New Family Keepsake",
    description:
      "Mark the beginning of a new family with a personalized wedding legacy gift: a symbolic final crest, certificate, story, and private collection.",
    eyebrow: "Personalized wedding legacy gift",
    h1: "A wedding gift for the family two people are beginning together.",
    lead:
      "A registry helps furnish a home. This collection honors the values, hopes, and shared direction that will shape the life built inside it.",
    buyerProblemTitle: "Give the couple something about the future they are choosing",
    buyerProblem:
      "The most meaningful wedding gifts recognize the relationship rather than simply adding another object. MyKinLegacy creates a symbolic keepsake around unity, faith when explicitly shared, home, guidance, and future generations.",
    recipientFit:
      "For newly married couples, engaged couples, blended families, or a son, daughter, sibling, or friend beginning a new household.",
    personalization: [
      "Both recipients and the occasion are treated as one shared beginning",
      "Values the couple wants to carry into their home",
      "A memory or place connected to how their relationship began",
      "Journey and unity symbols only when supported by their evidence"
    ],
    exampleIds: ["03-wedding-gift", "04-anniversary", "10-new-baby"],
    deliveryNote:
      "Digital delivery normally follows Founder review within two business days. The collection can be presented digitally or printed personally before the wedding date.",
    faq: [
      {
        question: "Can both names appear on the certificate?",
        answer:
          "Yes. Couple wording is kept consistent across the certificate, story, crest meaning, welcome, and private vault."
      },
      {
        question: "Does the crest claim a historic family coat of arms?",
        answer:
          "No. It is a new symbolic keepsake based on the couple's evidence, not an inherited heraldic grant."
      },
      {
        question: "Can this work for a blended family?",
        answer:
          "Yes. The intake can center belonging, unity, home, and the future the family is building together."
      }
    ],
    relatedSlugs: ["anniversary", "christmas-family", "family-reunion"]
  },
  {
    slug: "anniversary",
    primaryKeyword: "personalized anniversary gift for parents",
    title: "Personalized Anniversary Gift for Parents | Legacy Keepsake",
    description:
      "Honor the life your parents built together with a personalized anniversary gift shaped by commitment, family memories, and shared values.",
    eyebrow: "Anniversary gift for parents",
    h1: "Celebrate the family your parents built together.",
    lead:
      "An anniversary is not only about a date. It is about the home, traditions, choices, and relationships that grew from two people continuing to choose each other.",
    buyerProblemTitle: "Make the years together visible",
    buyerProblem:
      "Traditional anniversary gifts mark a material. A Family Legacy Collection marks the lived result: loyalty, patience, humor, resilience, and the family that now shares their story.",
    recipientFit:
      "For parents, grandparents, partners, or a couple celebrating a milestone anniversary and the family life that grew around it.",
    personalization: [
      "Both recipients are named consistently throughout the collection",
      "The anniversary milestone and a specific shared memory",
      "Values that describe how the relationship endured and grew",
      "Unity, roots, journey, or home symbols selected from real evidence"
    ],
    exampleIds: ["20-parents-anniversary", "04-anniversary", "18-immigration-anniversary"],
    deliveryNote:
      "Founder review protects recipient, occasion, and pronoun consistency before the digital collection is released through its private vault.",
    faq: [
      {
        question: "Is this suitable for a 25th or 50th anniversary?",
        answer:
          "Yes. The milestone can be included while the story remains focused on the couple's actual memories and values."
      },
      {
        question: "Can children give this to their parents together?",
        answer:
          "Yes. The dedication and story can speak from the family as a whole."
      },
      {
        question: "Is the delivery private?",
        answer:
          "Yes. Completed collections are private by default and released through a secure vault link."
      }
    ],
    relatedSlugs: ["wedding", "grandparents", "christmas-family"]
  },
  {
    slug: "christmas-family",
    primaryKeyword: "personalized Christmas family gift",
    title: "Personalized Christmas Family Gift | Legacy Collection",
    description:
      "Give the whole family a personalized Christmas keepsake built around shared traditions, gratitude, memories, and the values carried across generations.",
    eyebrow: "Personalized Christmas family gift",
    h1: "A Christmas gift the whole family can open and keep together.",
    lead:
      "Christmas gathers people around familiar stories. This collection gives those stories, values, and traditions a shared form that can remain meaningful after the season ends.",
    buyerProblemTitle: "Choose one family gift instead of another round of things",
    buyerProblem:
      "A whole-family gift needs to feel inclusive without becoming generic. MyKinLegacy uses specific traditions, memories, and family values to create one Final Crest and one collection for everyone being honored.",
    recipientFit:
      "For parents, grandparents, siblings, adult children, or an extended family gathering around Christmas traditions and shared gratitude.",
    personalization: [
      "A holiday tradition or memory the family immediately recognizes",
      "The whole family or named recipients, without mixing individual pronouns",
      "Values such as gratitude, joy, unity, home, love, or tradition",
      "A crest direction selected for the family's meaning rather than seasonal decoration"
    ],
    exampleIds: ["05-christmas-family", "20-parents-anniversary", "11-family-reunion"],
    deliveryNote:
      "This is a digital collection with no shipping delay, but personalization and Founder review still require time. Order before the day you plan to present it.",
    faq: [
      {
        question: "Is the design Christmas-themed?",
        answer:
          "The occasion shapes the dedication and tone, while the crest remains a lasting family keepsake rather than temporary holiday decoration."
      },
      {
        question: "Can the collection honor several generations?",
        answer:
          "Yes. Shared memories and values can connect grandparents, parents, and younger generations without inventing genealogy."
      },
      {
        question: "Will anything arrive by mail?",
        answer:
          "No. The Founder Edition is delivered digitally through a private vault."
      }
    ],
    relatedSlugs: ["family-reunion", "grandparents", "anniversary"]
  },
  {
    slug: "family-reunion",
    primaryKeyword: "personalized family reunion gift",
    title: "Personalized Family Reunion Gift | Shared Legacy Keepsake",
    description:
      "Create a personalized family reunion gift that recognizes shared roots, memories, values, and the meaning of gathering again.",
    eyebrow: "Personalized family reunion gift",
    h1: "Give the family a shared keepsake for the stories that bring everyone back.",
    lead:
      "A reunion is a rare chance to see the family as a whole. This collection turns the reason people gathered, the memories they share, and the values they want to continue into one private legacy keepsake.",
    buyerProblemTitle: "Create one focal gift for the gathering",
    buyerProblem:
      "Reunion favors are easy to distribute but easy to forget. A Family Legacy Collection gives relatives one meaningful artifact to open together and a digital archive they can preserve afterward.",
    recipientFit:
      "For extended families, siblings reuniting, multigenerational gatherings, immigration anniversaries, homecomings, and families reconnecting after years apart.",
    personalization: [
      "The place, tradition, or memory associated with gathering",
      "Values that connect relatives across households and generations",
      "A whole-family recipient treatment rather than one person's pronouns",
      "Continuity, path, roots, or home symbolism when supported by the family evidence"
    ],
    exampleIds: ["11-family-reunion", "18-immigration-anniversary", "05-christmas-family"],
    deliveryNote:
      "The collection is digitally delivered after Founder review and can be opened together at the reunion or shared privately afterward.",
    faq: [
      {
        question: "Can one collection represent the whole extended family?",
        answer:
          "Yes. The intake can use collective language and shared evidence while avoiding unsupported claims about every branch of the family."
      },
      {
        question: "Can we include a family motto?",
        answer:
          "A supplied motto can appear in supporting text when appropriate, but it is not presented as an ancient or official heraldic motto."
      },
      {
        question: "How is the collection shared?",
        answer:
          "The buyer receives a private vault and Complete Collection archive for personal family sharing and preservation."
      }
    ],
    relatedSlugs: ["christmas-family", "grandparents", "anniversary"]
  }
];

export function getGiftLandingPage(slug: string): GiftLandingPageSpec | undefined {
  return giftLandingPages.find((page) => page.slug === slug);
}

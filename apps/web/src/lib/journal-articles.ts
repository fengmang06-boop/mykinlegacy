import { getShowcaseCollection } from "./showcase-collections";

export type JournalSegment = string | { text: string; href: string };

export type JournalSection = {
  id: string;
  heading: string;
  paragraphs: JournalSegment[][];
  bullets?: JournalSegment[][];
  visualId?: string;
  visualAlt?: string;
  visualCaption?: string;
};

export type JournalFaq = {
  question: string;
  answer: JournalSegment[];
};

export type JournalSource = {
  name: string;
  organization: string;
  href: string;
};

export type JournalArticle = {
  slug: string;
  targetKeyword: string;
  title: string;
  metaTitle: string;
  description: string;
  dek: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  heroId: string;
  heroAlt: string;
  sections: JournalSection[];
  faqs: JournalFaq[];
  sources: JournalSource[];
  relatedSlugs: string[];
  commercialPath: string;
  commercialLabel: string;
};

const link = (text: string, href: string): JournalSegment => ({ text, href });
const p = (...segments: JournalSegment[]): JournalSegment[] => segments;

export const journalArticles: JournalArticle[] = [
  {
    slug: "family-legacy-gift-ideas",
    targetKeyword: "family legacy gift ideas",
    title: "11 Family Legacy Gift Ideas for Milestones That Deserve More",
    metaTitle: "11 Family Legacy Gift Ideas for Meaningful Milestones",
    description:
      "Explore thoughtful family legacy gift ideas for parents, grandparents, retirements, weddings, anniversaries, Christmas, and family reunions.",
    dek:
      "When practical gifts feel interchangeable, choose something that reflects a person, a relationship, or a family moment worth remembering.",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    author: "MyKinLegacy Editorial Team",
    heroId: "01-father-retirement",
    heroAlt: "Gold and black final crest created as a retirement gift for a father",
    commercialPath: "/family-legacy-collection",
    commercialLabel: "See what the Family Legacy Collection includes",
    sections: [
      {
        id: "what-makes-a-legacy-gift",
        heading: "Start with what the recipient has given, not what they own",
        paragraphs: [
          p(
            "A person who already has the watch, tools, kitchen equipment, or framed photographs may not need another object. A better starting question is: what have they contributed that the family has never properly put into words?"
          ),
          p(
            "A family legacy gift records that answer in a form the recipient can revisit. It might be a handwritten letter, a recorded conversation, a carefully labeled photo album, a commissioned portrait, or a personalized symbolic keepsake. The format matters less than the evidence behind it."
          ),
          p(
            "Before choosing, write down one memory, three qualities, and the occasion. Those details will quickly separate a personal gift from a generic one."
          )
        ]
      },
      {
        id: "ideas",
        heading: "11 family legacy gift ideas",
        paragraphs: [
          p(
            "The strongest option depends on whether your recipient likes to display, read, listen, gather, or quietly keep family material."
          )
        ],
        bullets: [
          p("A narrated family interview edited into a short audio keepsake."),
          p("A photo book with names, dates, places, and handwritten captions."),
          p("A framed letter explaining what the recipient taught the family."),
          p("A recipe book that preserves dishes alongside the stories attached to them."),
          p("A restored copy of an important photograph, with the original stored safely."),
          p("A map marking homes, migrations, reunions, or other shared places."),
          p("A memory box containing selected letters, photographs, and small objects."),
          p("A family tree created from verified records, without filling gaps by guesswork."),
          p("A short video assembled from family photographs and recorded messages."),
          p("A commissioned illustration of a home, workshop, garden, or gathering place."),
          p(
            "A personalized symbolic artwork and reading set shaped by memories and values, such as a ",
            link("MyKinLegacy Family Legacy Collection", "/family-legacy-collection"),
            "."
          )
        ],
        visualId: "03-wedding-gift",
        visualAlt: "Compass-inspired final crest made for a wedding gift example",
        visualCaption:
          "Wedding example: a compass-led design for two people beginning a shared direction."
      },
      {
        id: "occasion",
        heading: "Match the gift to the family moment",
        paragraphs: [
          p(
            "For retirement, recognize the work and care behind the career rather than celebrating free time alone. A ",
            link("father retirement example", "/real-examples/01-father-retirement"),
            " can focus on protection, sacrifice, and integrity without turning the recipient into a stereotype."
          ),
          p(
            "For a milestone birthday, choose one era, habit, or memory that relatives immediately recognize. For an anniversary or ",
            link("wedding", "/gifts/wedding"),
            ", focus on what two people have built or are beginning together. At Christmas or a ",
            link("family reunion", "/gifts/family-reunion"),
            ", a shared gift can honor the whole group instead of singling out one branch of the family."
          ),
          p(
            "A memorial gift needs a quieter approach. Use specific memories and leave room for hope; avoid grand claims about a life you cannot support."
          )
        ]
      },
      {
        id: "personality",
        heading: "Choose for the recipient's personality",
        paragraphs: [
          p(
            "A private person may value a letter, storybook, or digital archive more than a public presentation. Someone who loves hosting may prefer a piece that can be displayed and discussed. A practical recipient may appreciate a concise keepsake with a clear purpose rather than a large box of loosely connected items."
          ),
          p(
            "If the recipient enjoys family history, confirm whether they want research, memories, or artwork. These are different products. Genealogical research should rely on records; symbolic art should be described as interpretation; a family story should never turn an assumption into fact."
          )
        ]
      },
      {
        id: "digital-physical",
        heading: "Digital and physical keepsakes can work together",
        paragraphs: [
          p(
            "A digital gift is easy to share with relatives and can include print-ready pages. A physical gift creates an immediate presentation moment. You do not have to choose only one: a digital master can support a framed print, a bound book, and backup copies stored in separate places."
          ),
          p(
            "For original papers and photographs, follow preservation advice rather than treating a craft project as archival storage. The U.S. National Archives recommends cool, dry storage, suitable enclosures, and avoiding damaging adhesives. Its guidance also notes that display copies can protect originals from prolonged light exposure."
          )
        ]
      },
      {
        id: "decision",
        heading: "A five-minute decision test",
        paragraphs: [
          p("Ask these questions before purchasing or making the gift:")
        ],
        bullets: [
          p("Can I name the exact person or family moment this honors?"),
          p("Does it use a detail only our family would recognize?"),
          p("Will the recipient know why each element is there?"),
          p("Is it easy to keep, print, display, or revisit?"),
          p("Am I presenting memories honestly rather than inventing a history?")
        ],
        visualId: "06-grandfather-legacy",
        visualAlt: "Lantern final crest created for a grandfather legacy gift example",
        visualCaption:
          "Grandfather example: a lantern emphasizes memory and guidance rather than status."
      },
      {
        id: "next",
        heading: "See the difference before you choose",
        paragraphs: [
          p(
            "Browse ",
            link("real example collections", "/real-examples"),
            " to compare retirement, wedding, grandparent, anniversary, Christmas, and reunion directions. If you want to gather the source material yourself first, use the checklist in ",
            link("How to Create a Family Keepsake", "/journal/how-to-create-a-family-keepsake"),
            "."
          )
        ]
      }
    ],
    faqs: [
      {
        question: "What is a good legacy gift for someone who has everything?",
        answer: p(
          "Choose a gift built around a specific contribution, memory, or value rather than another possession. A recorded interview, captioned photo book, personal letter, or evidence-led symbolic keepsake can all work."
        )
      },
      {
        question: "Does a legacy gift have to be expensive?",
        answer: p(
          "No. A carefully written letter with one vivid memory may feel more personal than an expensive object. Cost does not replace attention."
        )
      },
      {
        question: "Can one gift be for the whole family?",
        answer: p(
          "Yes. Reunions, Christmas gatherings, anniversaries, and shared milestones can support a family-wide gift when the wording includes the group without inventing a single version of everyone's experience."
        )
      }
    ],
    sources: [
      {
        name: "How to Preserve Family Archives",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives"
      },
      {
        name: "Displaying Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/displaying"
      }
    ],
    relatedSlugs: ["how-to-create-a-family-keepsake", "retirement-gift-for-father"]
  },
  {
    slug: "what-is-a-family-crest",
    targetKeyword: "what is a family crest",
    title: "What Is a Family Crest? History, Symbols, and Modern Keepsakes",
    metaTitle: "What Is a Family Crest? Crest vs. Coat of Arms Explained",
    description:
      "Learn what a crest is, how it differs from a coat of arms, what heraldry can prove, and how modern symbolic family artwork should be described.",
    dek:
      "The phrase is widely used, but its historical meaning is narrower than many souvenir products suggest.",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    author: "MyKinLegacy Editorial Team",
    heroId: "03-wedding-gift",
    heroAlt: "Modern black and gold symbolic family crest artwork with compass medallion",
    commercialPath: "/symbolic-family-crest",
    commercialLabel: "Explore modern symbolic family crest artwork",
    sections: [
      {
        id: "short-answer",
        heading: "The short answer",
        paragraphs: [
          p(
            "In everyday modern speech, people often use “family crest” to mean an emblem associated with a family. In formal heraldry, a crest is not the entire shield design. The College of Arms defines it as a specific part of a full heraldic achievement: the object placed above the helm."
          ),
          p(
            "A coat of arms is the broader armorial design governed by the rules and authorities of a jurisdiction. A modern symbolic family artwork can borrow the visual language of shields, crests, medallions, or seals, but it should not be presented as an official grant or proof of ancestry unless that status has been properly established."
          )
        ]
      },
      {
        id: "terms",
        heading: "Crest, coat of arms, genealogy, and symbolic artwork are not the same",
        paragraphs: [
          p(
            "A heraldic crest is one component above a helm. A coat of arms is an armorial bearing associated with a person or body under a heraldic system. Genealogy investigates family relationships using evidence such as civil, church, census, probate, immigration, and other records. Symbolic family artwork interprets memories and values into a visual keepsake."
          ),
          p(
            "These categories can be related, but one cannot substitute for another. A shield illustration does not establish descent. A surname match does not establish entitlement to arms. A family story supplied by a buyer is not a certified genealogy."
          )
        ],
        visualId: "03-wedding-gift",
        visualAlt: "Modern compass medallion artwork for a wedding keepsake",
        visualCaption:
          "Modern symbolic artwork may use medallion language without claiming historical arms."
      },
      {
        id: "surname",
        heading: "Does every surname have a coat of arms?",
        paragraphs: [
          p(
            "No. The College of Arms states that there is no coat of arms for a surname as a whole. In its jurisdiction, arms are granted or confirmed to a person and pass under particular rules; people who share a surname may have different arms or no entitlement to any recorded arms."
          ),
          p(
            "The College also explains that proving a right to inherited arms requires evidence of descent from a person already recorded as entitled. Rules differ between countries and heraldic jurisdictions, so anyone seeking official recognition should consult the appropriate authority rather than relying on a decorative surname product."
          )
        ]
      },
      {
        id: "symbols",
        heading: "What can symbols communicate in a modern family keepsake?",
        paragraphs: [
          p(
            "Symbols can make personal evidence easier to see. A shield may express protection; a tree may represent continuity; a lantern can carry remembrance or guidance; a compass may suggest a journey or shared direction. The important question is not whether a symbol looks impressive. It is whether the recipient's story earns it."
          ),
          p(
            "For example, a father remembered for steady protection may suit a shield-led composition. A grandfather remembered for migration and guidance may be better served by a lantern or compass. These are contemporary design interpretations, not claims about rank, nobility, or ancestral armorial rights."
          )
        ]
      },
      {
        id: "mykinlegacy",
        heading: "What MyKinLegacy creates",
        paragraphs: [
          p(
            "MyKinLegacy creates personalized, heritage-inspired symbolic keepsakes from information provided through a guided interview. The process uses the recipient, occasion, memories, values, and preferences to shape a final crest artwork, certificate, family story, and explanation of the design."
          ),
          p(
            "It does not register arms, certify genealogy, authenticate lineage, confer a title, or establish a historical right to heraldic devices. The ",
            link("product disclaimer", "/disclaimer"),
            " states these boundaries directly."
          )
        ],
        visualId: "01-father-retirement",
        visualAlt: "Shield and tree symbolic artwork based on protection and family continuity",
        visualCaption:
          "Evidence-led example: shield, tree, and roots reflect protection and continuity."
      },
      {
        id: "checklist",
        heading: "A checklist before commissioning symbolic family artwork",
        paragraphs: [p("Ask the maker these questions:")],
        bullets: [
          p("Which details from the recipient's life will affect the design?"),
          p("Will the final explanation distinguish interpretation from historical fact?"),
          p("Does the service claim official registration, genealogy, or entitlement?"),
          p("Can you review examples that show genuinely different symbol choices?"),
          p("What exactly will be delivered, and is it digital or physical?")
        ]
      },
      {
        id: "next",
        heading: "See how evidence changes the result",
        paragraphs: [
          p(
            "Compare the ",
            link("Father Retirement", "/real-examples/01-father-retirement"),
            " and ",
            link("Wedding Gift", "/real-examples/03-wedding-gift"),
            " examples. Their different occasions and values lead to different visual centers. For a wider buying guide, read ",
            link("Family Legacy Gift Ideas", "/journal/family-legacy-gift-ideas"),
            "."
          )
        ]
      }
    ],
    faqs: [
      {
        question: "Is a family crest the same as a coat of arms?",
        answer: p(
          "Not in formal heraldry. A crest is a specific component above the helm, while a coat of arms refers to the wider armorial bearing. Everyday usage often blurs the terms."
        )
      },
      {
        question: "Can a crest prove my ancestry?",
        answer: p(
          "No. Artwork alone cannot prove descent or genealogical relationships. Those claims require documentary research and, for inherited arms, the rules and records of the relevant heraldic authority."
        )
      },
      {
        question: "Is MyKinLegacy official heraldry?",
        answer: p(
          "No. MyKinLegacy produces personalized symbolic artwork and keepsake documents. It does not grant, register, or authenticate coats of arms or genealogy."
        )
      }
    ],
    sources: [
      {
        name: "Heraldry FAQs",
        organization: "College of Arms",
        href: "https://www.college-of-arms.gov.uk/resources/faqs"
      },
      {
        name: "Proving a Right to Arms",
        organization: "College of Arms",
        href: "https://www.college-of-arms.gov.uk/services/proving-a-right-to-arms"
      },
      {
        name: "College of Arms: Coats of Arms",
        organization: "College of Arms",
        href: "https://www.college-of-arms.gov.uk/"
      }
    ],
    relatedSlugs: ["family-legacy-gift-ideas", "how-to-create-a-family-keepsake"]
  },
  {
    slug: "retirement-gift-for-father",
    targetKeyword: "retirement gift for father",
    title: "Retirement Gifts for a Father Who Has Everything",
    metaTitle: "Retirement Gift for Father: Personal Ideas Beyond the Plaque",
    description:
      "Choose a retirement gift for your father that recognizes his work, sacrifice, protection, integrity, and example without relying on generic ideas.",
    dek:
      "The most memorable retirement gift may not celebrate the end of work. It may finally recognize what his work made possible.",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    author: "MyKinLegacy Editorial Team",
    heroId: "01-father-retirement",
    heroAlt: "Classic shield and tree crest artwork created for a father's retirement",
    commercialPath: "/gifts/father-retirement",
    commercialLabel: "Create a retirement collection for your father",
    sections: [
      {
        id: "generic",
        heading: "Why many retirement gifts feel generic",
        paragraphs: [
          p(
            "Watches, plaques, gadgets, and gift cards can all be appropriate. The problem is not the category; it is that the object may say little about the person receiving it. A plaque that could be handed to any retiree records the event but not the life behind it."
          ),
          p(
            "A more personal gift identifies what your father's working years meant to the people around him. Perhaps he protected the family from uncertainty, kept his word, taught through example, built a business, served a community, or made sacrifices he rarely discussed. Choose only what is true for him."
          )
        ]
      },
      {
        id: "memory",
        heading: "Begin with one memory, not a list of adjectives",
        paragraphs: [
          p(
            "“Hardworking” is respectful but broad. “He left before sunrise for thirty-five years and still made it to every school performance” gives the family something they recognize. A single observed detail can carry more weight than a page of praise."
          ),
          p(
            "Ask siblings or relatives for one sentence each: What did his work allow the family to do? What habit showed his integrity? When did you understand what he had been carrying? You do not need a complete biography. You need enough evidence to make the tribute unmistakably his."
          )
        ]
      },
      {
        id: "options",
        heading: "Retirement gift ideas by personality",
        paragraphs: [
          p("Choose a format that fits how he likes to receive attention:")
        ],
        bullets: [
          p("For the private father: a personal letter or compact storybook he can read alone."),
          p("For the practical father: one frameable keepsake with restrained, direct wording."),
          p("For the storyteller: a recorded interview edited into short chapters."),
          p("For the maker: a portrait of his workshop, tools, farm, desk, or working place."),
          p("For the family historian: a captioned archive built from verified photographs and records."),
          p("For the visually minded: symbolic artwork explained through real values and memories.")
        ],
        visualId: "09-military-retirement",
        visualAlt: "Shield-led crest artwork for a military retirement example",
        visualCaption:
          "Military retirement example: protection and service are expressed without aggressive imagery."
      },
      {
        id: "example",
        heading: "Example: quiet strength made visible",
        paragraphs: [
          p(
            "The ",
            link("Father Retirement example", "/real-examples/01-father-retirement"),
            " begins with a father whose love was shown through steady work, protection, sacrifice, and integrity. The final artwork uses a shield, tree, roots, and laurel. The shield carries protection; the rooted tree gives his contribution a family context."
          ),
          p(
            "That direction would be wrong for every father. A teacher might call for a lantern or book. A father known for migration could suit a compass. Personalization depends on the evidence, not a fixed “dad” template."
          )
        ]
      },
      {
        id: "presentation",
        heading: "Plan the presentation, not just the purchase",
        paragraphs: [
          p(
            "Retirement events can be public, but the most personal part of the gift may be better read privately. Decide whether he would enjoy a speech, a family dinner, a quiet handover, or a message included with the gift."
          ),
          p(
            "If the gift is digital and printable, download it before the occasion, check every name and date, and decide which page to frame. MyKinLegacy delivers a digital product rather than a physical shipment; review the ",
            link("digital delivery details", "/digital-delivery"),
            " when timing your presentation."
          )
        ]
      },
      {
        id: "avoid",
        heading: "What to avoid",
        paragraphs: [
          p(
            "Do not assume every father wants jokes about age, golf, or doing nothing. Do not turn sacrifice into a claim that he never made mistakes. Do not write in masculine clichés when his actual personality offers better material. Recognition feels stronger when it is precise and believable."
          ),
          p(
            "Check the wording with someone who knows him well. The goal is not to make his life sound grander; it is to make his real contribution visible."
          )
        ]
      },
      {
        id: "next",
        heading: "Build the gift around what he gave",
        paragraphs: [
          p(
            "See the dedicated ",
            link("retirement gift for father page", "/gifts/father-retirement"),
            " or begin the ",
            link("guided creation process", "/create"),
            ". For more formats you can make or commission, read ",
            link("11 Family Legacy Gift Ideas", "/journal/family-legacy-gift-ideas"),
            "."
          )
        ]
      }
    ],
    faqs: [
      {
        question: "What is a personal retirement gift for a father who has everything?",
        answer: p(
          "Use a specific memory or contribution as the center of the gift. A letter, recorded interview, storybook, framed artwork, or symbolic keepsake can recognize what his working years meant to the family."
        )
      },
      {
        question: "Should a retirement gift mention his career?",
        answer: p(
          "Only as much as it helps explain the person. For some fathers, profession is central; for others, reliability, mentorship, sacrifice, or care matters more than the job title."
        )
      },
      {
        question: "When should I order a personalized retirement gift?",
        answer: p(
          "Allow time to gather memories, check names and dates, review the finished wording, and prepare any printing or framing before the event. Check the seller's current delivery terms rather than assuming same-day delivery."
        )
      }
    ],
    sources: [],
    relatedSlugs: ["family-legacy-gift-ideas", "how-to-create-a-family-keepsake"]
  },
  {
    slug: "personalized-gifts-for-grandparents",
    targetKeyword: "personalized gift for grandparents",
    title: "Personalized Gifts for Grandparents That Preserve More Than a Photo",
    metaTitle: "Personalized Gifts for Grandparents: Memory-Led Ideas",
    description:
      "Find personalized gifts for grandparents shaped by memories, migration, traditions, values, milestone birthdays, anniversaries, and family gatherings.",
    dek:
      "A grandparent gift feels personal when it preserves a recognizable voice, habit, story, place, or value without assuming every family looks the same.",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    author: "MyKinLegacy Editorial Team",
    heroId: "06-grandfather-legacy",
    heroAlt: "Lantern crest artwork created for a grandfather legacy gift",
    commercialPath: "/gifts/grandparents",
    commercialLabel: "Explore personalized gifts for grandparents",
    sections: [
      {
        id: "personal",
        heading: "Personal means recognizable, not merely customized",
        paragraphs: [
          p(
            "Adding a name to a mug makes it customized. A gift becomes personal when the recipient recognizes something true: the phrase they always use, the place they left or built, the tradition they keep, the meal everyone requests, or the way they helped the family through a difficult season."
          ),
          p(
            "Grandparents are not a single personality type or household structure. Some live nearby; some are separated by distance. Some are biological grandparents, others joined the family through marriage, adoption, friendship, or care. Build the gift around the relationship you actually share."
          )
        ]
      },
      {
        id: "evidence",
        heading: "Six kinds of family evidence worth gathering",
        paragraphs: [p("You can create a strong gift from a small, well-chosen set of details:")],
        bullets: [
          p("A memory: one moment relatives still retell."),
          p("A journey: a move, migration, homecoming, or new beginning."),
          p("A tradition: a meal, holiday habit, saying, song, or gathering."),
          p("A value: kindness, courage, faith, patience, humor, or practical wisdom in action."),
          p("A place: a home, garden, workshop, town, or landscape tied to family life."),
          p("A contribution: what the grandparent protected, taught, built, or kept together.")
        ]
      },
      {
        id: "occasions",
        heading: "Choose a different emphasis for each occasion",
        paragraphs: [
          p(
            "For a milestone birthday, celebrate the person in the present rather than treating the gift as a retrospective. For Christmas, focus on traditions and gathering. An anniversary can recognize what two people built together. A reunion gift may belong to the whole group."
          ),
          p(
            "Remembrance requires extra care. Use details the family provided, avoid inventing a complete life story, and end with what continues: a habit, lesson, welcome, or love carried forward."
          )
        ],
        visualId: "07-grandmother-birthday",
        visualAlt: "Lantern and archive frame crest artwork for a grandmother's birthday",
        visualCaption:
          "Grandmother birthday example: memory and wisdom are present without making the gift mournful."
      },
      {
        id: "ideas",
        heading: "Gift formats that can carry a grandparent's story",
        paragraphs: [
          p(
            "A recipe book can pair instructions with the person who taught them. A photo book becomes more useful when every image has names, dates, and places. An audio interview preserves voice and cadence. A framed letter gives the recipient something direct to read. A digital archive lets several branches of a family keep a copy."
          ),
          p(
            "A symbolic artwork can translate a few themes into a visual center. The ",
            link("Grandfather Legacy example", "/real-examples/06-grandfather-legacy"),
            " uses a lantern and archival frame for migration, guidance, resilience, and hope. The ",
            link("Grandmother Birthday example", "/real-examples/07-grandmother-birthday"),
            " uses related visual language for a different reason: keeping family stories alive."
          )
        ]
      },
      {
        id: "questions",
        heading: "Questions that invite real answers",
        paragraphs: [
          p(
            "Avoid asking only, “Tell me your life story.” Broad prompts can feel like work. Ask about the first home they remember, a family meal, a difficult decision, something they learned from their parents, or a tradition they hope someone will continue."
          ),
          p(
            "Respect a refusal. Not every experience belongs in a gift, and not every relative agrees on the same account. Use material the recipient or family is comfortable preserving."
          )
        ]
      },
      {
        id: "privacy",
        heading: "Think about privacy before sharing",
        paragraphs: [
          p(
            "Decide who should receive the material before collecting it. Avoid publishing private addresses, full birth dates, account information, health details, or family conflicts. If several relatives contribute, tell them how their words and photographs will be used."
          ),
          p(
            "MyKinLegacy's ",
            link("privacy page", "/privacy"),
            " explains how its guided interview data is handled. The finished product is digital and printable; it is not a public family-history database."
          )
        ],
        visualId: "12-memorial",
        visualAlt: "Lantern memorial keepsake crest with restrained gold ornament",
        visualCaption:
          "Memorial example: remembrance is handled quietly and leaves room for hope."
      },
      {
        id: "preserve",
        heading: "Preserve originals and copies differently",
        paragraphs: [
          p(
            "The U.S. National Archives advises keeping family papers and photographs in cool, dry conditions and using suitable enclosures rather than damaging glues or tapes. Its digitization guidance recommends keeping originals because digital files bring their own risks."
          ),
          p(
            "For digital material, keep more than one copy and store copies separately. Give files descriptive names and include a simple note explaining who appears, when the item was made, and why it matters."
          )
        ]
      },
      {
        id: "next",
        heading: "Make one memory the starting point",
        paragraphs: [
          p(
            "Browse ",
            link("grandparent gift examples", "/gifts/grandparents"),
            " or use ",
            link("How to Create a Family Keepsake", "/journal/how-to-create-a-family-keepsake"),
            " to organize the material before choosing a format."
          )
        ]
      }
    ],
    faqs: [
      {
        question: "What makes a grandparent gift feel personal?",
        answer: p(
          "Use a detail the recipient recognizes: a phrase, place, tradition, memory, contribution, or value shown through action. A name alone is customization, not deep personalization."
        )
      },
      {
        question: "What can grandchildren contribute?",
        answer: p(
          "They can add drawings, short messages, questions, photographs, or a memory of something they do with the grandparent. Keep the contribution in the child's natural voice."
        )
      },
      {
        question: "Can a grandparent gift be shared by the whole family?",
        answer: p(
          "Yes. A shared archive, storybook, or artwork can include several branches of a family as long as the contributors agree on what is included and no single story is presented as everyone's experience."
        )
      }
    ],
    sources: [
      {
        name: "Storing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/storing"
      },
      {
        name: "Digitizing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/digitizing"
      }
    ],
    relatedSlugs: ["how-to-create-a-family-keepsake", "family-legacy-gift-ideas"]
  },
  {
    slug: "how-to-create-a-family-keepsake",
    targetKeyword: "how to create a family keepsake",
    title: "How to Create a Family Keepsake from Memories and Everyday Evidence",
    metaTitle: "How to Create a Family Keepsake: A Practical Guide",
    description:
      "Learn how to create a family keepsake from names, memories, values, photographs, sayings, places, and traditions without inventing family history.",
    dek:
      "You do not need a complete family archive. One clear recipient, one honest memory, and a few well-chosen details are enough to begin.",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    author: "MyKinLegacy Editorial Team",
    heroId: "20-parents-anniversary",
    heroAlt: "Shield and tree crest artwork made for a parents anniversary keepsake",
    commercialPath: "/create",
    commercialLabel: "Start the guided MyKinLegacy creation process",
    sections: [
      {
        id: "recipient",
        heading: "1. Choose the recipient and the moment",
        paragraphs: [
          p(
            "Write one sentence: “This is for ___ because ___.” The answer might be a father retiring, grandparents reaching an anniversary, a couple getting married, or a family gathering after years apart."
          ),
          p(
            "This decision controls tone. A retirement gift may recognize contribution; a wedding gift looks forward; a memorial holds remembrance and hope; a reunion piece belongs to a group. Do not combine every family occasion into one project."
          )
        ]
      },
      {
        id: "evidence",
        heading: "2. Gather a small evidence set",
        paragraphs: [
          p("Collect only material that helps the recipient recognize themselves:")
        ],
        bullets: [
          p("Names and preferred forms of address."),
          p("One personal memory with a place, action, or detail."),
          p("Two or three values shown through behavior."),
          p("A saying, recipe, tradition, object, or family habit."),
          p("One place connected to home, work, migration, or gathering."),
          p("Photographs with known people, dates, and context."),
          p("The occasion and the message you want the recipient to carry away.")
        ],
        visualId: "11-family-reunion",
        visualAlt: "Mountain and path artwork for a family reunion keepsake",
        visualCaption:
          "Family reunion example: gathering, roots, and resilience create the direction."
      },
      {
        id: "memory",
        heading: "3. Turn broad praise into a scene",
        paragraphs: [
          p(
            "“She was kind” is a conclusion. “She always set another place at the table without asking who was coming” gives the reader a scene. Look for actions, repeated habits, and small decisions."
          ),
          p(
            "If relatives remember an event differently, do not force certainty. Attribute the memory, use neutral wording, or leave it out. A keepsake should interpret what the family knows, not create missing history."
          )
        ]
      },
      {
        id: "format",
        heading: "4. Choose a format with one clear job",
        paragraphs: [
          p(
            "A frameable certificate recognizes the occasion. A storybook carries emotion. An illustrated guide explains artwork. A photo book organizes images. An audio interview preserves voice. A memory box holds physical objects."
          ),
          p(
            "Avoid asking one item to do everything. When several pieces are included, give each a distinct role and a clear reading order."
          )
        ]
      },
      {
        id: "write",
        heading: "5. Write for recognition, not grandeur",
        paragraphs: [
          p(
            "Use the words family members would naturally understand. Remove inflated claims, generic motivational phrases, and descriptions that could belong to anyone. Read the text aloud; if it sounds like an award citation instead of a person, simplify it."
          ),
          p(
            "Symbols should follow the same rule. A tree, lantern, compass, shield, book, or mountain belongs only when the evidence supports its meaning. For the distinction between symbolic artwork and official heraldry, read ",
            link("What Is a Family Crest?", "/journal/what-is-a-family-crest"),
            "."
          )
        ],
        visualId: "20-parents-anniversary",
        visualAlt: "Tree and shield artwork created from anniversary and family unity evidence",
        visualCaption:
          "Parents anniversary example: the artwork centers unity and continuity rather than a generic surname."
      },
      {
        id: "privacy",
        heading: "6. Set privacy boundaries before collecting",
        paragraphs: [
          p(
            "Tell contributors what you are making and who will see it. Exclude personal data that does not serve the gift. Ask permission before using sensitive stories or photographs supplied by someone else."
          ),
          p(
            "Keep the working material in a controlled location and delete duplicate exports you no longer need. A finished family keepsake does not require public posting."
          )
        ]
      },
      {
        id: "preserve",
        heading: "7. Preserve the originals and the finished files",
        paragraphs: [
          p(
            "The U.S. National Archives recommends cool, dry storage for family papers and photographs, suitable containers, and avoiding damaging glues, tapes, rubber bands, and unstable plastics. It also recommends keeping originals after digitization because digital copies have their own risks."
          ),
          p(
            "For digital files, the Library of Congress advises identifying what to save, organizing it, keeping copies on at least two storage media in separate locations, and migrating copies as storage technology changes. Use clear file names and include a plain-text note describing the contents."
          )
        ]
      },
      {
        id: "review",
        heading: "8. Run a family review before presenting it",
        paragraphs: [p("Use this final check:")],
        bullets: [
          p("Are names, dates, relationships, and the occasion correct?"),
          p("Does every important statement come from supplied evidence?"),
          p("Could any paragraph apply unchanged to a different family?"),
          p("Are private details included only with permission?"),
          p("Does each item have a clear purpose?"),
          p("Can the recipient easily open, read, print, or store it?")
        ]
      },
      {
        id: "mykinlegacy",
        heading: "A guided way to turn the evidence into a finished gift",
        paragraphs: [
          p(
            "MyKinLegacy's ",
            link("guided interview", "/create"),
            " asks for a recipient, occasion, memories, values, and visual preferences, then turns that material into a final crest, certificate, family story, and explanation. It is a symbolic keepsake service, not genealogy research or official heraldry."
          ),
          p(
            "You can also browse ",
            link("real examples", "/real-examples"),
            " or compare other formats in ",
            link("Family Legacy Gift Ideas", "/journal/family-legacy-gift-ideas"),
            "."
          )
        ]
      }
    ],
    faqs: [
      {
        question: "How much information do I need to make a family keepsake?",
        answer: p(
          "Start with one recipient, one occasion, one specific memory, and two or three lived values. Add names, photographs, sayings, or places only when they improve recognition."
        )
      },
      {
        question: "Should I include every family story?",
        answer: p(
          "No. Select material that serves the gift, can be supported, and is appropriate to share. A focused keepsake is usually stronger than an unedited archive."
        )
      },
      {
        question: "How should I back up a digital family keepsake?",
        answer: p(
          "Keep organized copies on at least two storage media and in separate locations. Use descriptive file names, retain source context, and review the copies as technology changes."
        )
      }
    ],
    sources: [
      {
        name: "How to Preserve Family Archives",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives"
      },
      {
        name: "Digitizing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/digitizing"
      },
      {
        name: "Digital Preservation and Personal Archiving",
        organization: "Library of Congress",
        href: "https://www.loc.gov/preservation/about/faqs/reformatting.html"
      }
    ],
    relatedSlugs: ["family-legacy-gift-ideas", "what-is-a-family-crest"]
  }
];

export function getJournalArticle(slug: string): JournalArticle | undefined {
  return journalArticles.find((article) => article.slug === slug);
}

export function getJournalVisual(id: string) {
  const collection = getShowcaseCollection(id);
  if (!collection) {
    throw new Error(`Unknown journal visual: ${id}`);
  }
  return collection;
}

export function journalArticleText(article: JournalArticle): string {
  const segmentText = (segments: JournalSegment[]) =>
    segments.map((segment) => (typeof segment === "string" ? segment : segment.text)).join(" ");
  return [
    article.title,
    article.dek,
    ...article.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs.map(segmentText),
      ...(section.bullets ?? []).map(segmentText)
    ]),
    ...article.faqs.flatMap((faq) => [faq.question, segmentText(faq.answer)])
  ].join("\n");
}

export function journalArticleWordCount(article: JournalArticle): number {
  return journalArticleText(article).match(/[A-Za-z0-9’'-]+/g)?.length ?? 0;
}

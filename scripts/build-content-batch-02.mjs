import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const draftRoot = path.join(root, "docs", "seo", "content-batch-02");
const outputPath = path.join(
  root,
  "apps",
  "web",
  "src",
  "lib",
  "journal-articles-batch-02.json"
);

const configs = [
  {
    directory: "01-family-reunion-gift-ideas",
    slug: "family-reunion-gift-ideas",
    targetKeyword: "family reunion gift ideas",
    metaTitle: "Meaningful Family Reunion Gift Ideas That Preserve Stories",
    description:
      "Explore family reunion gift ideas that preserve shared memories, places, values, and stories—not only the event date or a standard event favor.",
    heroId: "11-family-reunion",
    heroAlt: "Tree-centered gold and black final crest created for a family reunion example",
    visualHeading: "Seven story-first reunion gift directions",
    visualId: "11-family-reunion",
    visualAlt: "Tree and roots final crest representing shared generations at a family reunion",
    visualCaption:
      "Family reunion example: a rooted tree gives shared memory and continuity one clear visual center.",
    commercialPath: "/gifts/family-reunion",
    commercialLabel: "Create a meaningful family reunion gift",
    relatedSlugs: ["family-legacy-gift-ideas", "how-to-create-a-family-keepsake"],
    sources: [
      {
        name: "Digitizing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/digitizing"
      },
      {
        name: "Personal Digital Archiving",
        organization: "Library of Congress",
        href: "https://www.loc.gov/static/programs/digital-preservation/personal-digital-archiving/"
      },
      {
        name: "Displaying Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/displaying"
      }
    ]
  },
  {
    directory: "02-anniversary-gifts-for-parents",
    slug: "personalized-anniversary-gifts-for-parents",
    targetKeyword: "personalized anniversary gifts for parents",
    metaTitle: "Personalized Anniversary Gifts for Parents with Meaning",
    description:
      "Choose a personalized anniversary gift for parents that honors the shared memories, values, traditions, and family life they built together.",
    heroId: "20-parents-anniversary",
    heroAlt: "Gold and black tree crest created for a parents anniversary gift example",
    visualHeading: "A story-to-symbol example",
    visualId: "20-parents-anniversary",
    visualAlt: "Tree and shield artwork shaped by evidence about a couple and the family they built",
    visualCaption:
      "Parents anniversary example: the tree and shield reflect continuity, welcome, and a life built together.",
    commercialPath: "/gifts/anniversary",
    commercialLabel: "Create an anniversary gift shaped by their life together",
    relatedSlugs: ["family-legacy-gift-ideas", "family-reunion-gift-ideas"],
    sources: [
      {
        name: "Why Are There Special Gifts for Each Anniversary Year?",
        organization: "TIME",
        href: "https://time.com/4771179/history-anniversary-gifts-paper-silver-gold/"
      },
      {
        name: "Anniversary and Birthday Traditions Around the World",
        organization: "Timeanddate.com",
        href: "https://www.timeanddate.com/date/anniversary-gift-traditions.html"
      },
      {
        name: "Digitizing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/digitizing"
      },
      {
        name: "Displaying Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/displaying"
      }
    ]
  },
  {
    directory: "03-modern-family-crest",
    slug: "how-to-create-a-modern-family-crest",
    targetKeyword: "how to create a modern family crest",
    metaTitle: "How to Create a Modern Family Crest from Real Stories",
    description:
      "Learn how to create a modern family crest from real memories and values—without claiming inherited arms, verified ancestry, or historical status.",
    heroId: "01-father-retirement",
    heroAlt: "Shield and tree final crest used to explain evidence-led modern symbolic artwork",
    visualHeading: "Compare three evidence-to-design examples",
    visualId: "06-grandfather-legacy",
    visualAlt: "Lantern final crest showing how memory and guidance can lead a symbolic composition",
    visualCaption:
      "Grandparent example: the lantern leads because remembered guidance is stronger evidence than status imagery.",
    commercialPath: "/symbolic-family-crest",
    commercialLabel: "Create a modern family symbol grounded in your own people, places, values, and memories",
    relatedSlugs: ["what-is-a-family-crest", "family-legacy-gift-ideas"],
    sources: [
      {
        name: "FAQs: heraldry",
        organization: "College of Arms",
        href: "https://www.college-of-arms.gov.uk/resources/faqs"
      }
    ]
  },
  {
    directory: "04-personalized-wedding-gifts-for-couples",
    slug: "personalized-wedding-gifts-for-couples",
    targetKeyword: "personalized wedding gifts for couples",
    metaTitle: "Personalized Wedding Gifts for Couples with Meaning",
    description:
      "Find a personalized wedding gift for a couple that reflects both people, their shared story, values, places, and the future they are beginning.",
    heroId: "03-wedding-gift",
    heroAlt: "Compass and path final crest created for a personalized wedding gift example",
    visualHeading: "Compare five wedding gift directions",
    visualId: "03-wedding-gift",
    visualAlt: "Compass-led final crest representing two people beginning a shared direction",
    visualCaption:
      "Wedding example: the compass and path express shared direction without assuming a surname or family structure.",
    commercialPath: "/gifts/wedding",
    commercialLabel: "Create a wedding gift grounded in both people",
    relatedSlugs: ["family-legacy-gift-ideas", "how-to-create-a-modern-family-crest"],
    sources: [
      {
        name: "Digitizing Family Papers and Photographs",
        organization: "U.S. National Archives",
        href: "https://www.archives.gov/preservation/family-archives/digitizing"
      },
      {
        name: "FAQs: heraldry",
        organization: "College of Arms",
        href: "https://www.college-of-arms.gov.uk/resources/faqs"
      }
    ]
  }
];

function cleanInline(value) {
  return value
    .replace(/^>\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function segments(value) {
  const text = cleanInline(value);
  const result = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      result.push(text.slice(cursor, match.index));
    }
    result.push({ text: match[1], href: match[2] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    result.push(text.slice(cursor));
  }
  return result.length > 0 ? result : [text];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isDivider(line) {
  return /^\|?\s*:?-{3,}/.test(line);
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => segments(cell));
}

function parseBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "subheading", text: cleanInline(line.slice(4)) });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quoteLines.push(lines[index].trim().replace(/^>\s*/, ""));
        index += 1;
      }
      const quoteText = quoteLines.join(" ");
      blocks.push({
        type: /^\*\*Note:\*\*/.test(quoteText) ? "note" : "quote",
        segments: segments(quoteText)
      });
      continue;
    }
    if (line.startsWith("|") && index + 1 < lines.length && isDivider(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      const type = bullet ? "bullets" : "numbered";
      const items = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const itemMatch = type === "bullets"
          ? itemLine.match(/^[-*]\s+(.+)$/)
          : itemLine.match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(segments(itemMatch[1]));
        index += 1;
      }
      blocks.push({ type, items });
      continue;
    }
    blocks.push({ type: "paragraph", segments: segments(line) });
    index += 1;
  }
  return blocks;
}

function parseDraft(config) {
  const filePath = path.join(draftRoot, config.directory, "ARTICLE-DRAFT.md");
  const lines = fs.readFileSync(filePath, "utf8").replace(/\r/g, "").split("\n");
  const title = cleanInline(lines.find((line) => line.startsWith("# ")).slice(2));
  const tocIndex = lines.findIndex((line) => line.trim() === "## Table of Contents");
  const preToc = lines.slice(1, tocIndex).filter((line) => line.trim());
  const dek = cleanInline(preToc[0]);
  const intro = parseBlocks(preToc.slice(1));
  const sections = [];
  const faqs = [];

  let index = tocIndex + 1;
  while (index < lines.length && !lines[index].startsWith("## ")) {
    index += 1;
  }
  while (index < lines.length) {
    const heading = cleanInline(lines[index].slice(3));
    const start = index + 1;
    index = start;
    while (index < lines.length && !lines[index].startsWith("## ")) {
      index += 1;
    }
    const body = lines.slice(start, index);
    if (heading === "Sources") {
      break;
    }
    if (heading === "Frequently Asked Questions") {
      let question = null;
      let answerLines = [];
      const flush = () => {
        if (question) {
          faqs.push({ question, answer: segments(answerLines.filter(Boolean).join(" ")) });
        }
      };
      for (const rawLine of body) {
        const faqLine = rawLine.trim();
        if (faqLine.startsWith("### ")) {
          flush();
          question = cleanInline(faqLine.slice(4));
          answerLines = [];
        } else if (faqLine) {
          answerLines.push(faqLine);
        }
      }
      flush();
      continue;
    }
    const section = {
      id: slugify(heading),
      heading,
      paragraphs: [],
      blocks: parseBlocks(body)
    };
    if (heading === config.visualHeading) {
      Object.assign(section, {
        visualId: config.visualId,
        visualAlt: config.visualAlt,
        visualCaption: config.visualCaption
      });
    }
    sections.push(section);
  }

  return {
    slug: config.slug,
    targetKeyword: config.targetKeyword,
    title,
    metaTitle: config.metaTitle,
    description: config.description,
    dek,
    publishedAt: "2026-07-16",
    updatedAt: "2026-07-16",
    author: "MyKinLegacy Editorial Team",
    heroId: config.heroId,
    heroAlt: config.heroAlt,
    intro,
    sections,
    faqs,
    sources: config.sources,
    relatedSlugs: config.relatedSlugs,
    commercialPath: config.commercialPath,
    commercialLabel: config.commercialLabel
  };
}

const articles = configs.map(parseDraft);
fs.writeFileSync(outputPath, `${JSON.stringify(articles, null, 2)}\n`, "utf8");

for (const article of articles) {
  console.log(`${article.slug}: ${article.sections.length} sections, ${article.faqs.length} FAQs`);
}

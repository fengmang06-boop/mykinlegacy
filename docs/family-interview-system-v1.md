# Family Interview System v1.0

Status: Sprint 1 - Day 1 strategic design  
Project: P001  
Primary question: What questions truly help us understand a family?  
Principle: The interview should form House Identity before AI begins.

This document does not change code, database, API, Worker, Prompt, frontend, or product behavior. It defines the future standard for the MyKinLegacy Family Interview.

The interview is not a form. It is the first act of interpretation.

## 1. Current Interview Analysis

The current interview is functional but not yet a true Family Interview.

It currently asks six fixed steps:

1. What name should your house story carry?
2. Where does your family story begin?
3. Which values should guide the design?
4. Choose a guardian symbol.
5. Select colors and visual style.
6. Create or refine a motto.

The current backend normalization primarily detects countries, colors, a small set of values, animals, and forbidden elements from text. It does not yet deeply interpret life moment, recipient, memory anchor, family member influence, emotional pattern, future hope, or recognition signal.

### 1.1 Questions With Limited Value

| Current question | Issue | Why it has limited recognition value |
| --- | --- | --- |
| Where does your family story begin? | Too location-heavy | Country alone rarely explains identity. It can create false ancestry expectations. |
| Choose a guardian symbol. | Premature symbol choice | Users choose animals aesthetically before the system understands meaning. |
| Select colors and visual style. | Too visual too early | Style should translate interpretation, not replace it. |
| Create or refine a motto. | Asked before enough meaning exists | A motto is stronger after values, story, and future hope are known. |

### 1.2 Repeated or Overlapping Questions

| Area | Repetition |
| --- | --- |
| House name and surname | "Use my surname" can duplicate later surname/house identity logic. |
| Values and motto | Both ask for identity language, but current flow does not connect them. |
| Guardian symbol and visual style | Both are visual-choice questions before emotional interpretation. |
| Heritage and style | Celtic/Gothic/Nordic style can be confused with heritage origin. |

### 1.3 Questions That Feel Too AI-Oriented

| Current pattern | Why it feels AI-oriented |
| --- | --- |
| Choose a guardian symbol | Feels like selecting prompt ingredients. |
| Select colors and visual style | Feels like configuring image generation. |
| Create or refine a motto | Feels like text generation before identity is understood. |
| Six focused prompts for surname, origin, values, symbols, colors, style, motto | Feels like an AI input checklist. |

### 1.4 Questions That Feel Like a Form

The current interview relies heavily on option grids. Option grids are efficient, but they can make the customer feel like they are completing a product configuration form.

Form-like signals:

- fixed multiple-choice options
- limited country list
- symbol selection before story
- colors and style as one step
- "Add your own words" as secondary instead of central
- no interviewer-like follow-up

### 1.5 Questions That May Not Affect Final Collection Enough

| Input | Risk |
| --- | --- |
| Preferred style | May affect visual mood but not recognition. |
| Country selection | May affect motifs but can remain shallow without story. |
| Guardian animal | May become decorative if not tied to a person, value, or memory. |
| Color choice | Often aesthetic unless connected to meaning. |
| House name | Useful, but not enough to form identity by itself. |

### 1.6 Missing Questions

The current interview does not directly ask:

- Why are you creating this collection now?
- Who is this for?
- Which family member shaped you most?
- What should future generations remember?
- What story should not be lost?
- What would make the recipient emotional?
- What should this collection make your family feel?
- What should be avoided?
- What makes your family different from others?
- What would make you say, "This feels like us"?

These missing questions are likely more important than country, animal, color, and style.

## 2. Interview Philosophy

A great Family Interview should feel like a documentary conversation, not a survey.

The user should feel:

- "Someone is helping me remember."
- "This is asking about what matters."
- "I do not need perfect ancestry records."
- "I can explain my family in my own words."
- "The product is listening before generating."
- "This is private and respectful."

The interview should not feel like:

- an AI prompt builder
- a genealogy quiz
- a logo brief
- a design configuration form
- a forced emotional questionnaire
- a fake official heraldry lookup

### 2.1 Interview Design Principles

1. Start with why, not what.
2. Ask about the life moment before symbols.
3. Ask about people before style.
4. Ask about values before visuals.
5. Ask about memory before motto.
6. Ask about emotional intent before artifact selection.
7. Make uncertainty acceptable.
8. Make sensitive questions optional.
9. Let the user speak in their own words.
10. Finish by confirming whether the interpretation feels true.

### 2.2 The Documentary Interview Standard

A documentary interviewer does not ask:

"Pick a lion, wolf, or eagle."

They ask:

"Who taught your family what strength looks like?"

The first question creates an image. The second creates identity.

MyKinLegacy should ask questions that reveal the family beneath the inputs.

## 3. Interview Structure

The future interview should use adaptive depth, not one fixed path.

### 3.1 Recommended Core Structure

| Step | Name | Purpose | Output |
| --- | --- | --- | --- |
| 1 | The Reason | Understand why this collection is being created now | Life Moment and intent |
| 2 | The Recipient | Understand who should feel seen | Recipient and gift intent |
| 3 | The Family Portrait | Understand the family in the customer's own words | Family identity summary |
| 4 | The Person Who Shaped Us | Identify emotional anchor | Memory anchor |
| 5 | The Values | Identify what the family stands for | Value hierarchy |
| 6 | The Story to Preserve | Identify what future generations should remember | Legacy theme |
| 7 | The Future Hope | Identify what the family wants to pass forward | Future-facing meaning |
| 8 | The Symbols | Translate meaning into symbolic candidates | Meaning-based symbols |
| 9 | The Visual Feeling | Capture visual preference after identity is known | Art direction |
| 10 | The Recognition Review | Let user confirm the interpreted identity | Identity completeness |

### 3.2 Why This Structure Is Better

It moves from human meaning to visual translation:

Reason -> Recipient -> Family -> Person -> Values -> Story -> Future -> Symbols -> Visuals -> Confirmation

This order prevents the most common failure:

Visual choices before identity understanding.

### 3.3 Required vs Optional

| Question type | Required? | Reason |
| --- | --- | --- |
| Life Moment | Required | Without it, interpretation lacks purpose. |
| Recipient/use case | Required | Gift and self-use need different narratives. |
| Family description | Required | Baseline identity signal. |
| Values | Required | Strong recognition driver. |
| Story to preserve | Strongly recommended | Drives narrative depth. |
| Family member who shaped you | Optional but high value | Can be sensitive. |
| Grief/memorial details | Optional and path-specific | Must be handled gently. |
| Adoption/blended family details | Optional and path-specific | Must support inclusion. |
| Symbols | Optional | System can suggest symbols from meaning. |
| Colors/style | Optional | Should guide translation, not identity. |

## 4. Interview Question Library

Scores use 1-5.

| # | Question | Use case | Importance | Emotional Depth | Identity Value | Recognition Contribution | User Fatigue |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Why are you creating this collection now? | All | 5 | 4 | 5 | 5 | 2 |
| 2 | Who is this collection for? | All/gift | 5 | 3 | 4 | 5 | 1 |
| 3 | What do you hope this person feels when they receive it? | Gift | 5 | 5 | 4 | 5 | 2 |
| 4 | If your family had to be described in one sentence, what would it be? | All | 5 | 4 | 5 | 5 | 3 |
| 5 | Which family member shaped you most? | Memory | 5 | 5 | 5 | 5 | 3 |
| 6 | What did that person teach the family? | Memory | 5 | 5 | 5 | 5 | 3 |
| 7 | What story should future generations remember? | Legacy | 5 | 5 | 5 | 5 | 3 |
| 8 | What values define your family at its best? | All | 5 | 4 | 5 | 5 | 2 |
| 9 | What has your family had to overcome? | Legacy/memory | 4 | 5 | 5 | 5 | 4 |
| 10 | What makes your family different from other families? | Identity | 5 | 4 | 5 | 5 | 3 |
| 11 | What should this collection never imply or include? | Safety | 5 | 2 | 4 | 4 | 2 |
| 12 | What family tradition feels most meaningful? | Memory | 4 | 4 | 4 | 4 | 3 |
| 13 | Is there a phrase, saying, or motto your family repeats? | Story | 4 | 4 | 5 | 5 | 2 |
| 14 | What place feels most connected to your family story? | Heritage/home | 4 | 4 | 4 | 4 | 2 |
| 15 | What object, photo, recipe, or memory represents your family? | Memory | 4 | 5 | 5 | 5 | 3 |
| 16 | How do you hope your children describe your family one day? | Future | 5 | 5 | 5 | 5 | 3 |
| 17 | What should the collection feel like: proud, warm, solemn, hopeful, or something else? | Tone | 5 | 3 | 4 | 5 | 1 |
| 18 | Which words should describe your family: loyal, resilient, gentle, bold, faithful, creative, protective, wise? | Values | 4 | 3 | 5 | 4 | 1 |
| 19 | What does strength look like in your family? | Identity | 4 | 4 | 5 | 5 | 3 |
| 20 | What does love look like in your family? | Identity | 4 | 5 | 5 | 5 | 3 |
| 21 | What does protection mean in your family? | Guardian | 4 | 4 | 5 | 5 | 2 |
| 22 | What does home mean to your family? | Home | 4 | 4 | 4 | 4 | 2 |
| 23 | What are you most proud of in your family? | Pride | 5 | 4 | 5 | 5 | 2 |
| 24 | What do you wish more people understood about your family? | Identity | 4 | 5 | 5 | 5 | 4 |
| 25 | What part of your family story feels unfinished? | Reflection | 3 | 5 | 4 | 4 | 4 |
| 26 | If this were a gift, what message should it carry? | Gift | 5 | 4 | 4 | 5 | 2 |
| 27 | Should this collection honor the past, celebrate the present, or point to the future? | Direction | 5 | 3 | 5 | 5 | 1 |
| 28 | What should be remembered about your father? | Father | 5 | 5 | 5 | 5 | 3 |
| 29 | What should be remembered about your mother? | Mother | 5 | 5 | 5 | 5 | 3 |
| 30 | What should be remembered about your grandparent? | Grandparent | 5 | 5 | 5 | 5 | 3 |
| 31 | What did your parents sacrifice or build for the family? | Parents | 5 | 5 | 5 | 5 | 4 |
| 32 | What would make your father smile or feel understood? | Father gift | 5 | 5 | 5 | 5 | 3 |
| 33 | What would make your mother feel honored? | Mother gift | 5 | 5 | 5 | 5 | 3 |
| 34 | What lesson from a grandparent should continue? | Grandparent | 5 | 5 | 5 | 5 | 3 |
| 35 | What family memory still makes people laugh? | Warmth | 3 | 4 | 4 | 4 | 2 |
| 36 | What family memory still makes people emotional? | Memory | 4 | 5 | 5 | 5 | 4 |
| 37 | What is the oldest family story you know? | Heritage | 3 | 4 | 4 | 4 | 3 |
| 38 | What do you know about where your family came from? | Heritage | 4 | 3 | 4 | 3 | 2 |
| 39 | Is your heritage certain, uncertain, mixed, chosen, or still being discovered? | Heritage | 5 | 3 | 5 | 4 | 2 |
| 40 | What country, region, or culture should inspire the collection, if any? | Heritage | 3 | 2 | 3 | 3 | 1 |
| 41 | What should we be careful not to overstate about your ancestry? | Trust | 5 | 2 | 4 | 4 | 2 |
| 42 | Is this family inherited, chosen, blended, rebuilt, or remembered? | Belonging | 5 | 4 | 5 | 5 | 2 |
| 43 | For a blended family, what brings everyone together? | Blended | 5 | 5 | 5 | 5 | 3 |
| 44 | For adoption, what language feels most respectful and true? | Adoption | 5 | 5 | 5 | 5 | 4 |
| 45 | For a wedding, what are the two families bringing together? | Wedding | 5 | 4 | 5 | 5 | 3 |
| 46 | For a wedding, what should not be lost from either side? | Wedding | 5 | 4 | 5 | 5 | 3 |
| 47 | For a new child, what promise do you want to pass down? | First child | 5 | 5 | 5 | 5 | 3 |
| 48 | For a memorial, what tone would feel right: quiet, grateful, proud, tender, or reverent? | Memorial | 5 | 5 | 5 | 5 | 2 |
| 49 | For a family reunion, what should everyone feel connected to? | Reunion | 4 | 4 | 5 | 5 | 2 |
| 50 | For a first home, what does this new place mean for the family? | Home | 4 | 4 | 4 | 4 | 2 |
| 51 | What symbol already feels meaningful to your family? | Symbol | 4 | 3 | 4 | 4 | 1 |
| 52 | Why does that symbol matter? | Symbol | 5 | 4 | 5 | 5 | 2 |
| 53 | Is there an animal that reminds you of your family? Why? | Symbol | 4 | 3 | 4 | 4 | 2 |
| 54 | Is there a tree, flower, mountain, river, or star that feels connected to your family? | Symbol | 3 | 3 | 4 | 4 | 2 |
| 55 | Which colors feel emotionally right for your family? | Visual | 3 | 2 | 3 | 3 | 1 |
| 56 | What should those colors mean? | Visual | 4 | 3 | 4 | 4 | 2 |
| 57 | Should the collection feel classic, warm, ceremonial, minimal, ornate, or modern? | Visual | 3 | 2 | 3 | 3 | 1 |
| 58 | Where do you imagine using or displaying this collection? | Utility | 4 | 2 | 3 | 4 | 1 |
| 59 | Would you frame this, gift it, archive it, or share it privately? | Utility | 4 | 2 | 3 | 4 | 1 |
| 60 | What would make this feel too generic? | Recognition | 5 | 3 | 5 | 5 | 2 |
| 61 | What detail would instantly make this feel like your family? | Recognition | 5 | 5 | 5 | 5 | 3 |
| 62 | What should a stranger understand about your family after seeing the collection? | Identity | 4 | 4 | 5 | 4 | 3 |
| 63 | What should only your family understand? | Privacy/identity | 4 | 5 | 5 | 5 | 4 |
| 64 | What should the recipient feel first: pride, comfort, gratitude, remembrance, joy, or belonging? | Emotion | 5 | 4 | 5 | 5 | 1 |
| 65 | What should the collection help your family remember in 20 years? | Legacy | 5 | 5 | 5 | 5 | 3 |
| 66 | What do you hope this collection starts a conversation about? | Legacy | 4 | 4 | 5 | 5 | 3 |
| 67 | Who in the family should feel especially seen? | Recipient | 5 | 4 | 5 | 5 | 2 |
| 68 | Is there anyone whose story should be handled gently? | Sensitivity | 5 | 4 | 5 | 4 | 3 |
| 69 | Are there any family topics we should avoid? | Safety | 5 | 3 | 4 | 4 | 2 |
| 70 | Should the collection feel more like a celebration, tribute, blessing, archive, or new beginning? | Direction | 5 | 3 | 5 | 5 | 1 |
| 71 | What does your surname mean to you personally? | Surname | 4 | 3 | 4 | 4 | 2 |
| 72 | Is the surname central, secondary, or not important to the collection? | Surname | 5 | 2 | 4 | 4 | 1 |
| 73 | Do you want one family name, two names, or a house name represented? | Naming | 4 | 2 | 3 | 4 | 1 |
| 74 | What would be a wrong way to represent your family? | Safety | 5 | 4 | 5 | 5 | 2 |
| 75 | If your family had a role in the world, what would it be? | Archetype | 4 | 4 | 5 | 5 | 3 |
| 76 | Is your family more protective, adventurous, wise, creative, faithful, resilient, or nurturing? | Archetype | 4 | 3 | 5 | 4 | 1 |
| 77 | What do younger generations need to know about older generations? | Legacy | 5 | 5 | 5 | 5 | 3 |
| 78 | What did older generations give that should not be forgotten? | Legacy | 5 | 5 | 5 | 5 | 3 |
| 79 | What future are you hoping your family grows toward? | Future | 5 | 5 | 5 | 5 | 3 |
| 80 | What does responsibility mean in your family? | Values | 4 | 4 | 5 | 5 | 3 |
| 81 | What does resilience mean in your family? | Values | 4 | 4 | 5 | 5 | 3 |
| 82 | What does faith or belief mean in your family, if relevant? | Values | 3 | 4 | 4 | 4 | 4 |
| 83 | What does humor mean in your family? | Personality | 3 | 3 | 4 | 4 | 2 |
| 84 | What does work or craft mean in your family? | Personality | 3 | 3 | 4 | 4 | 2 |
| 85 | What does service mean in your family? | Values | 3 | 3 | 4 | 4 | 2 |
| 86 | What should the motto sound like: simple, poetic, traditional, modern, spiritual, or bold? | Motto | 3 | 2 | 3 | 3 | 1 |
| 87 | What words should never appear in the motto? | Motto safety | 4 | 2 | 3 | 3 | 1 |
| 88 | Should the motto speak to the past, the present, or the future? | Motto | 4 | 3 | 4 | 4 | 1 |
| 89 | What is one sentence you wish you could say to the recipient? | Gift | 5 | 5 | 5 | 5 | 3 |
| 90 | What would make the recipient say, "They really know me"? | Gift | 5 | 5 | 5 | 5 | 3 |
| 91 | What would make your family proud to display this? | Display | 4 | 3 | 4 | 4 | 2 |
| 92 | What would make your family uncomfortable displaying this? | Display safety | 5 | 3 | 4 | 4 | 2 |
| 93 | Do you prefer the collection to feel intimate or public-facing? | Privacy/tone | 4 | 3 | 4 | 4 | 1 |
| 94 | Should this feel like a personal keepsake or a family statement? | Direction | 5 | 3 | 5 | 5 | 1 |
| 95 | What emotion should be strongest when someone opens the collection? | Emotion | 5 | 4 | 5 | 5 | 1 |
| 96 | If the collection could only say one thing, what should it say? | Essence | 5 | 5 | 5 | 5 | 3 |
| 97 | What detail should we double-check with you before finalizing? | Confirmation | 4 | 2 | 4 | 4 | 1 |
| 98 | Which part of this interpretation feels most true? | Review | 5 | 4 | 5 | 5 | 2 |
| 99 | Which part feels least true? | Review | 5 | 4 | 5 | 5 | 2 |
| 100 | Would your family recognize themselves in this direction? Why or why not? | Review | 5 | 5 | 5 | 5 | 3 |

## 5. Top 20 Golden Questions

These questions most directly determine "This feels like us."

| Rank | Golden Question | Why it matters |
| --- | --- | --- |
| 1 | Why are you creating this collection now? | Reveals Life Moment, urgency, and purpose. |
| 2 | Who is this collection for? | Determines narrative, tone, and artifact emphasis. |
| 3 | What do you hope this person feels when they receive it? | Converts information into gift intent. |
| 4 | If your family had to be described in one sentence, what would it be? | Forces identity synthesis. |
| 5 | Which family member shaped you most? | Reveals emotional anchor. |
| 6 | What did that person teach the family? | Turns memory into value. |
| 7 | What story should future generations remember? | Creates legacy theme. |
| 8 | What values define your family at its best? | Establishes value hierarchy. |
| 9 | What makes your family different from other families? | Drives specificity. |
| 10 | What would make this feel too generic? | Prevents failure before it happens. |
| 11 | What detail would instantly make this feel like your family? | Captures recognition signal. |
| 12 | How do you hope your children describe your family one day? | Reveals future hope. |
| 13 | What should this collection never imply or include? | Protects safety and trust. |
| 14 | What family tradition feels most meaningful? | Adds memory and ritual. |
| 15 | Is there a phrase, saying, or motto your family repeats? | Adds authentic voice. |
| 16 | What object, photo, recipe, or memory represents your family? | Turns abstract values concrete. |
| 17 | Should this collection honor the past, celebrate the present, or point to the future? | Sets narrative direction. |
| 18 | What should a stranger understand about your family after seeing the collection? | Defines public identity signal. |
| 19 | What should only your family understand? | Defines private recognition layer. |
| 20 | Would your family recognize themselves in this direction? Why or why not? | Final recognition test. |

## 6. Adaptive Interview

The interview should dynamically select questions based on Life Moment.

### 6.1 Universal Core

Every path should ask:

1. Why are you creating this collection now?
2. Who is this for?
3. What values define your family?
4. What should future generations remember?
5. What would make this feel like your family?
6. What should we avoid?

### 6.2 Wedding Path

Purpose: joining two stories into one future.

Ask:

- What are the two families bringing together?
- What should not be lost from either side?
- What values should define your new household?
- Should the collection feel ceremonial, romantic, traditional, modern, or intimate?
- What symbol could represent the future you are building?

Avoid:

- assuming one surname dominates
- overusing royal or official heraldic language
- making the design feel like a business logo

### 6.3 Father's Day / Father Gift Path

Purpose: make gratitude visible.

Ask:

- What should be remembered or honored about your father?
- What did he build, protect, or teach?
- What would make him smile or feel understood?
- What does strength mean in your family?
- What sentence do you wish you could say to him?

Avoid:

- generic masculine symbols
- overusing lions, shields, and armor without meaning
- making the tone too grand if the father is quiet or humble

### 6.4 Memorial Path

Purpose: preserve memory with dignity.

Ask:

- What should be remembered about this person?
- What tone would feel right: quiet, grateful, proud, tender, or reverent?
- What detail would the family immediately recognize?
- What should be handled gently?
- What should not be included?

Avoid:

- urgent sales language
- triumphant tone unless requested
- overclaiming legacy
- asking too many painful details too early

### 6.5 Grandparents Path

Purpose: preserve generational wisdom.

Ask:

- What lesson from your grandparent should continue?
- What story, saying, or tradition reminds you of them?
- What did they give the family emotionally?
- What should younger generations know?
- What object, recipe, place, or memory represents them?

Avoid:

- reducing grandparents to age or nostalgia
- generic "wisdom" without specific memory

### 6.6 First Child Path

Purpose: pass values into the future.

Ask:

- What promise do you want to pass down?
- How do you hope your child describes your family one day?
- What family values should surround this child?
- What story should they know when they are older?
- Should this feel gentle, hopeful, protective, or celebratory?

Avoid:

- asking unnecessary sensitive child details
- making the collection too adult or too childish

### 6.7 Adoption Path

Purpose: welcome and belonging with care.

Ask:

- What language feels most respectful and true?
- What does family mean in this context?
- What should this child feel when they see the collection one day?
- What should we avoid implying?
- What values define the family you are building together?

Avoid:

- bloodline assumptions
- origin speculation
- savior language
- forced sentimentality

### 6.8 Blended Family Path

Purpose: create shared identity without erasing history.

Ask:

- What brings everyone together?
- What should each side feel is respected?
- What new value or tradition belongs to this family now?
- What language should we avoid?
- What symbol could represent unity without pretending the past did not exist?

Avoid:

- implying all complexity is resolved
- centering one surname too strongly
- excluding stepfamily or chosen family members

### 6.9 Immigrant / Mixed Heritage Path

Purpose: bridge roots, movement, and future.

Ask:

- What did your family carry from one place to another?
- What are you grateful your family preserved?
- What has changed in the new home?
- What should future generations remember about the journey?
- What should we avoid overstating about ancestry?

Avoid:

- stereotypes
- national emblem copying
- false certainty
- treating heritage as costume

## 7. Interview Quality Score

The Interview Quality Score measures identity completeness, not question count.

Score each dimension 1-10.

| Dimension | Question |
| --- | --- |
| Life Moment Clarity | Do we know why this collection is being created now? |
| Recipient Clarity | Do we know who should feel seen? |
| Value Hierarchy | Do we know which values matter most? |
| Memory Anchor | Do we have a person, place, story, object, phrase, or tradition? |
| Emotional Tone | Do we know how the collection should feel? |
| Legacy Direction | Do we know what should be passed down? |
| Recognition Signal | Do we know what would make this feel specific? |
| Safety Boundary | Do we know what to avoid? |
| Symbol Readiness | Are symbols tied to meaning rather than aesthetics? |
| Visual Readiness | Do visual preferences support identity instead of replacing it? |

### 7.1 Score Bands

| Score | Meaning | Action |
| --- | --- | --- |
| 0-39 | Weak interview | Ask follow-up questions before interpretation. |
| 40-59 | Basic identity | Can produce generic collection, but recognition risk is high. |
| 60-79 | Strong identity | Ready for interpretation and art direction. |
| 80-100 | Excellent identity | High likelihood of "This feels like us." |

### 7.2 Minimum Identity Completeness

Before generation, the system should know at least:

- Life Moment
- Recipient or use case
- 3 Core Values
- Emotional Tone
- Story or memory anchor
- Future/legacy direction
- What to avoid
- Recognition signal

If these are missing, the system may still generate something beautiful, but it is unlikely to feel deeply personal.

## 8. Founder Review

If I were Founder, these are the 10 questions I would be most proud to make central to MyKinLegacy.

| Rank | Question | Founder reason |
| --- | --- | --- |
| 1 | Why are you creating this collection now? | It shifts the company from generator to Life Moment Brand. |
| 2 | Which family member shaped you most? | It reveals the human anchor behind identity. |
| 3 | What story should future generations remember? | It makes the product about legacy, not decoration. |
| 4 | What values define your family at its best? | It turns family identity into meaning. |
| 5 | What detail would instantly make this feel like your family? | It directly targets Family Recognition. |
| 6 | What would make this feel too generic? | It prevents the biggest product failure. |
| 7 | What do you hope the recipient feels when they receive it? | It makes gifts emotionally precise. |
| 8 | Is this family inherited, chosen, blended, rebuilt, or remembered? | It makes the brand inclusive and modern. |
| 9 | What should this collection never imply or include? | It protects trust. |
| 10 | Would your family recognize themselves in this direction? Why or why not? | It makes the user a co-interpreter before generation. |

## 9. Top 10 Biggest Interview Mistakes

1. Asking for visual style before understanding the family.
2. Treating surname as identity.
3. Treating country as story.
4. Treating animal choice as meaning.
5. Asking too many multiple-choice questions.
6. Making free text secondary.
7. Asking for a motto before narrative exists.
8. Ignoring who the collection is for.
9. Ignoring what should be avoided.
10. Measuring completion by question count instead of identity completeness.

## 10. Top 10 Biggest Opportunities

1. Make Life Moment the first interpretation anchor.
2. Build gift-specific emotional questions.
3. Create memory-anchor questions for parents and grandparents.
4. Add recognition-signal questions.
5. Use adaptive paths for wedding, memorial, adoption, blended family, and first child.
6. Let users say "I don't know" without weakening the result.
7. Ask fewer symbol questions but deeper meaning questions.
8. Use review questions before generation to confirm House Identity.
9. Score Interview Quality before any AI work begins.
10. Make the interview feel like a documentary conversation.

## 11. Strategic Conclusion

The future MyKinLegacy interview should not collect prompt ingredients.

It should understand:

- why this moment matters
- who should feel seen
- what the family stands for
- what should be remembered
- what must be handled gently
- what symbols mean in context
- what would make the family say, "This feels like us"

The best Family Interview is not the one that asks the most questions.

It is the one that forms House Identity before AI begins.

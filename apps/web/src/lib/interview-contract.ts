export const INTERVIEW_STEPS = [
  {
    code: "name_your_house",
    label: "Recipient",
    question: "Who is this collection for?",
    options: [
      "My father",
      "My mother",
      "My parents",
      "A grandparent",
      "A couple",
      "Our whole family"
    ],
    required: true
  },
  {
    code: "where_story_begins",
    label: "Moment",
    question: "What moment makes this gift meaningful now?",
    options: [
      "Father's Day",
      "Mother's Day",
      "Christmas",
      "Retirement",
      "Anniversary",
      "Family reunion"
    ],
    required: true
  },
  {
    code: "define_house_values",
    label: "Values",
    question: "Which values should this collection honor?",
    options: ["Courage", "Wisdom", "Loyalty", "Resilience", "Faith", "Creativity"],
    required: true
  },
  {
    code: "choose_guardian_symbol",
    label: "Recognition",
    question: "What should they feel recognized for?",
    options: [
      "Protecting the family",
      "Keeping traditions alive",
      "Working hard for others",
      "Holding everyone together",
      "Teaching by example",
      "Building a home"
    ],
    required: true
  },
  {
    code: "select_colors_and_visual_style",
    label: "Symbolic direction",
    question: "Which symbolic direction feels right for your family?",
    options: [
      "Tree and family continuity",
      "Compass and shared direction",
      "Lantern and guidance",
      "Mountain and resilience",
      "Deep green and antique brass",
      "Warm ivory and soft charcoal"
    ],
    required: true
  }
] as const;

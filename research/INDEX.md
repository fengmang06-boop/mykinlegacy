# Family Recognition Lab Notebook

Status: Experiment Sprint 001  
Date: 2026-06-30  
Role: Chief Scientist  
Research objective: Test whether interpretation-first artifacts show stronger Family Recognition than prompt-first artifacts.

Important boundary: Sprint 001 does not generate final images, call AI models, modify prompts in production, or change product behavior. It creates controlled research artifacts and scores them with the Family Recognition rubric. Conclusions are preliminary and must be validated later with human reviewers and generated collections.

## Unified Evaluation Rubric

All scores use 1-10.

| Metric | Definition |
| --- | --- |
| Family Recognition | Would this likely make the family say, "This feels like us"? |
| Meaning Consistency | Do symbols, values, and life context support each other? |
| Narrative Consistency | Does the story direction logically match the input? |
| Gift Worthiness | Would this work as a meaningful gift? |
| Emotional Resonance | Does the emotional tone fit the life moment? |
| Keepsake Value | Would the output feel worth saving? |
| Authenticity | Does it feel grounded rather than generic or fake? |
| Story Depth | Does it go beyond surface-level details? |
| Identity Strength | Is there a clear family identity signal? |
| This Feels Like Us | Direct likelihood of user recognition |

## Sprint 001 Experiments

| Experiment | Title | Hypothesis | Status | Confidence | Notebook |
| --- | --- | --- | --- | --- | --- |
| EXP-001 | Life Moment Validation | Adding Life Moment improves Family Recognition | Completed | Medium | [EXP-001.md](EXP-001.md) |
| EXP-002 | Values Validation | Family Values matter more than surname | Completed | Medium | [EXP-002.md](EXP-002.md) |
| EXP-003 | Narrative Validation | Narrative before prompt improves recognition | Completed | Medium | [EXP-003.md](EXP-003.md) |
| EXP-004 | Meaning Graph Validation | Meaning Graph outperforms simple symbol use | Completed | Medium | [EXP-004.md](EXP-004.md) |
| EXP-005 | Identity DNA Validation | Identity DNA changes interpretation quality | Completed | Low-Medium | [EXP-005.md](EXP-005.md) |

## Sprint 001 Dataset Families

| Family ID | Short scenario |
| --- | --- |
| FAM-001 | Father passed away; adult child wants a tribute |
| FAM-002 | Couple getting married; two families joining |
| FAM-003 | Child asked where family came from |
| FAM-004 | Grandmother is aging; family wants to preserve her story |
| FAM-005 | Immigrant parents celebrating anniversary |
| FAM-006 | Blended family creating a shared identity |
| FAM-007 | First family home purchased |
| FAM-008 | Parents have everything; children need a meaningful gift |
| FAM-009 | Family reunion organizer wants a shared symbol |
| FAM-010 | New grandparent wants to pass down values |

## Sprint 001 Aggregate Findings

| Experiment | Control average | Test average | Lift | Main learning |
| --- | ---: | ---: | ---: | --- |
| EXP-001 | 5.2 | 7.4 | +2.2 | Life Moment adds emotional direction and purpose |
| EXP-002 | 5.7 | 7.6 | +1.9 | Values create stronger identity than surname alone |
| EXP-003 | 5.5 | 7.9 | +2.4 | Narrative-first improves coherence and gift meaning |
| EXP-004 | 5.8 | 8.1 | +2.3 | Meaning Graph prevents generic symbol use |
| EXP-005 | 5.9 | 8.0 | +2.1 | Identity DNA changes interpretation depth |

## Sprint 001 Caution

These are internal research observations based on controlled artifact comparison. They are not yet proven customer outcomes. The next stage must introduce human reviewers, blind comparison, and eventually generated visual collections.

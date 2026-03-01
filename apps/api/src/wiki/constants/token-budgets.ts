export const TOKEN_BUDGETS = {
  GROUPING_PLAN_INPUT: 8000,
  GROUPING_PLAN_OUTPUT: 2000,
  // Raised from 1500 → 3000: batches with many function structures were hitting
  // the old cap, truncating the JSON mid-string and causing parse failures.
  FILE_CLASSIFIER_INPUT: 6000,
  FILE_CLASSIFIER_OUTPUT: 3000,
  // Raised from 3000 → 4000: large subsystems with many public interfaces
  // need extra headroom for citations, overviews, and howItWorks sections.
  DEEP_ANALYSIS_INPUT: 10000,
  DEEP_ANALYSIS_OUTPUT: 4000,
  QA_ANSWER_INPUT: 4000,
  QA_ANSWER_OUTPUT: 1000,
} as const;

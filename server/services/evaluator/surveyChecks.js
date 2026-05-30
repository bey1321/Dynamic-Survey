export function checkVariableCoverage(questions, variableModel) {
  if (!variableModel) return [];

  const allVariables = [
    ...(Array.isArray(variableModel.dependent) ? variableModel.dependent : []),
    ...(Array.isArray(variableModel.drivers)   ? variableModel.drivers   : []),
    ...(Array.isArray(variableModel.controls)  ? variableModel.controls  : []),
  ];

  const covered = new Set(questions.map(q => q.variable).filter(Boolean));

  return allVariables
    .filter(v => !covered.has(v))
    .map(v => ({ variable: v, issue: `No question measures variable: "${v}"` }));
}

export function validateSkipLogic(questions) {
  const issues = [];
  const questionIds = new Set(questions.map(q => q.id));

  for (const q of questions) {
    if (q.branchFrom) {
      if (!questionIds.has(q.branchFrom)) {
        issues.push({ question: q.text, issue: `Branch references non-existent question: ${q.branchFrom}` });
      }
      if (!q.branchCondition || !q.branchCondition.operator) {
        issues.push({ question: q.text, issue: "Branch condition missing or invalid" });
      }
    }
  }

  return issues;
}

export function checkResponseScaleConsistency(questions) {
  const issues = [];

  function findInconsistencies(type) {
    const scales = questions
      .filter(q => q.type === type && Array.isArray(q.options))
      .map(q => q.options.length);

    if (scales.length === 0) return;

    const dominant = scales.sort(
      (a, b) => scales.filter(v => v === b).length - scales.filter(v => v === a).length
    )[0];

    questions
      .filter(q => q.type === type && Array.isArray(q.options))
      .forEach(q => {
        if (q.options.length !== dominant) {
          issues.push({
            question: q.text,
            issue: `Inconsistent ${type} scale: uses ${q.options.length}-point scale but survey mostly uses ${dominant}-point`,
          });
        }
      });
  }

  findInconsistencies("likert");
  findInconsistencies("rating");

  return issues;
}

export function validateResponseOptions(options = []) {
  const problems = [];

  if (!Array.isArray(options) || options.length === 0) return problems;

  const validOptions = options.filter(o => String(o).trim().length > 0);
  if (validOptions.length === 0) {
    problems.push("no_valid_options");
    return problems;
  }

  const normalized = validOptions.map(o => String(o).trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) problems.push("duplicate_options");

  const hasYes = normalized.includes("yes");
  const hasNo  = normalized.includes("no");
  if ((hasYes || hasNo) && normalized.length > 2) problems.push("yes_no_mixed_with_other_choices");

  if (validOptions.length === 1) problems.push("only_one_option");

  return problems;
}

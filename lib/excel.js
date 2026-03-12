const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { normalizeFullName, normalizeGroupNumber } = require("./validation");

const USER_FILE_NAMES = ["mephi_users.xlsx", "mephi_usres.xlsx"];

let cache = {
  filePath: "",
  mtimeMs: 0,
  records: []
};

function findColumnIndex(headers, patterns, fallbackIndex) {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  return index === -1 ? fallbackIndex : index;
}

function resolveUsersFilePath() {
  for (const fileName of USER_FILE_NAMES) {
    const fullPath = path.join(process.cwd(), fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(process.cwd(), USER_FILE_NAMES[0]);
}

function loadRecords() {
  const usersFilePath = resolveUsersFilePath();

  if (!fs.existsSync(usersFilePath)) {
    throw new Error(`Users file is missing: ${usersFilePath}`);
  }

  const stat = fs.statSync(usersFilePath);
  if (
    cache.records.length &&
    cache.mtimeMs === stat.mtimeMs &&
    cache.filePath === usersFilePath
  ) {
    return cache.records;
  }

  const workbook = XLSX.readFile(usersFilePath);
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    cache = { filePath: usersFilePath, mtimeMs: stat.mtimeMs, records: [] };
    return cache.records;
  }

  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length <= 1) {
    cache = { filePath: usersFilePath, mtimeMs: stat.mtimeMs, records: [] };
    return cache.records;
  }

  const headers = rows[0].map((cell) => String(cell || "").trim());
  const fioIndex = findColumnIndex(headers, [/фио/i, /ф\.?\s*и\.?\s*о\.?/i, /name/i], 0);
  let groupIndex = findColumnIndex(headers, [/групп/i, /group/i], 1);
  if (groupIndex === fioIndex) {
    groupIndex = groupIndex === 0 ? 1 : 0;
  }

  const records = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const fullName = normalizeFullName(row[fioIndex]);
    const groupNumber = normalizeGroupNumber(row[groupIndex]);

    if (!fullName || !groupNumber) {
      continue;
    }

    records.push({ fullName, groupNumber });
  }

  cache = {
    filePath: usersFilePath,
    mtimeMs: stat.mtimeMs,
    records
  };

  return records;
}

function studentExists(fullName, groupNumber) {
  const normalizedFullName = normalizeFullName(fullName);
  const normalizedGroupNumber = normalizeGroupNumber(groupNumber);
  if (!normalizedFullName || !normalizedGroupNumber) {
    return false;
  }

  const records = loadRecords();
  return records.some(
    (record) =>
      record.fullName === normalizedFullName &&
      record.groupNumber === normalizedGroupNumber
  );
}

module.exports = {
  studentExists
};

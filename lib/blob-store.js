const { list, put } = require("@vercel/blob");

function normalizeTgId(tgId) {
  return String(tgId || "").trim();
}

async function hasRegistrationFolder(tgId) {
  const normalized = normalizeTgId(tgId);
  if (!normalized) {
    return false;
  }

  const response = await list({
    prefix: `${normalized}/`,
    limit: 1
  });

  return response.blobs.length > 0;
}

async function saveRegistrationFile(tgId, timestampMs, content) {
  const normalized = normalizeTgId(tgId);
  const key = `${normalized}/${timestampMs}.txt`;
  const envAccess = String(process.env.BLOB_ACCESS || "").toLowerCase();
  const explicitAccess = envAccess === "public" || envAccess === "private" ? envAccess : null;

  const attemptAccessValues = explicitAccess
    ? [explicitAccess, explicitAccess === "public" ? "private" : "public"]
    : [null, "public", "private"];

  const putWithAccess = (access) => {
    const options = {
      addRandomSuffix: false,
      contentType: "text/plain; charset=utf-8"
    };
    if (access) {
      options.access = access;
    }
    return put(key, content, options);
  };

  const isAccessMismatch = (error) => {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("cannot use public access on a private store") ||
      message.includes('access must be "public"') ||
      message.includes("access must be public")
    );
  };

  let lastError = null;
  for (let index = 0; index < attemptAccessValues.length; index += 1) {
    const access = attemptAccessValues[index];
    try {
      return await putWithAccess(access);
    } catch (error) {
      lastError = error;
      const hasNext = index < attemptAccessValues.length - 1;
      if (!hasNext || !isAccessMismatch(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = {
  hasRegistrationFolder,
  saveRegistrationFile
};

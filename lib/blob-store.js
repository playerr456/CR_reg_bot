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
  const preferredAccess = process.env.BLOB_ACCESS === "private" ? "private" : "public";
  const fallbackAccess = preferredAccess === "public" ? "private" : "public";

  const putWithAccess = (access) =>
    put(key, content, {
      addRandomSuffix: false,
      access,
      contentType: "text/plain; charset=utf-8"
    });

  try {
    return await putWithAccess(preferredAccess);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const canRetryWithFallback =
      (preferredAccess === "public" &&
        message.includes("cannot use public access on a private store")) ||
      (preferredAccess === "private" && message.includes("access must be public"));

    if (!canRetryWithFallback) {
      throw error;
    }

    return putWithAccess(fallbackAccess);
  }
}

module.exports = {
  hasRegistrationFolder,
  saveRegistrationFile
};

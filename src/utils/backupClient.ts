const API_BASE = '/api/backup';

export const checkBackupStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}-status`);
    return await res.json();
  } catch (err) {
    return { connected: false, message: 'Failed to verify backup connection', counts: {} };
  }
};

export const syncAllToMongoBackup = async (collections: any) => {
  try {
    const res = await fetch(`${API_BASE}-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collections),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    // console.error(err);
    return false;
  }
};

export const fetchFromMongoBackup = async <T,>(collectionName: string): Promise<T[]> => {
  try {
    const res = await fetch(`${API_BASE}/${collectionName}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    // console.error(err);
    return [];
  }
};

export const saveToMongoBackup = async (collectionName: string, item: any) => {
  try {
    await fetch(`${API_BASE}/${collectionName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
  } catch (err) {
    // console.error(err);
  }
};

export const deleteFromMongoBackup = async (collectionName: string, id: string) => {
  try {
    await fetch(`${API_BASE}/${collectionName}/${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    // console.error(err);
  }
};

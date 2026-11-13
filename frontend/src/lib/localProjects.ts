/**
 * Local offline project management for the Hybrid Storage Architecture.
 * Provides strict privacy and storage isolation per user account and guest mode.
 */

export interface SavedProjectMeta {
  id: string;
  title: string;
  docWidth: number;
  docHeight: number;
  thumbnailUrl: string;
  sizeBytes: number;
  updatedAt: string;
  isLocalOnly?: boolean;
}

function getIndexKey(userId?: string | null): string {
  return userId ? `uvs_local_projects_user_${userId}` : "uvs_local_projects_guest";
}

function getProjectKey(id: string, userId?: string | null): string {
  return userId ? `uvs_proj_user_${userId}_${id}` : `uvs_proj_guest_${id}`;
}

export function listLocalProjects(userId?: string | null): SavedProjectMeta[] {
  try {
    const key = getIndexKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Backward compatibility fallback for legacy guest items
      if (!userId) {
        const legacy = localStorage.getItem("uvs_local_projects_index");
        if (legacy) return JSON.parse(legacy);
      }
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalProject(
  id: string,
  title: string,
  docWidth: number,
  docHeight: number,
  layersData: string,
  thumbnailUrl: string,
  userId?: string | null
): SavedProjectMeta {
  const sizeBytes = layersData.length + thumbnailUrl.length;
  const updatedAt = new Date().toISOString();
  const projKey = getProjectKey(id, userId);

  // Save the full project content in isolated per-user key
  try {
    localStorage.setItem(
      projKey,
      JSON.stringify({
        id,
        title,
        docWidth,
        docHeight,
        layersData,
        thumbnailUrl,
        updatedAt,
      })
    );
  } catch (err) {
    console.warn("Storage quota exceeded for local project payload:", err);
  }

  // Update isolated index
  const indexKey = getIndexKey(userId);
  const list = listLocalProjects(userId).filter((p) => p.id !== id);
  const meta: SavedProjectMeta = {
    id,
    title,
    docWidth,
    docHeight,
    thumbnailUrl,
    sizeBytes,
    updatedAt,
    isLocalOnly: true,
  };
  list.unshift(meta);

  try {
    localStorage.setItem(indexKey, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to update local project index:", e);
  }

  return meta;
}

export function getLocalProject(id: string, userId?: string | null): any | null {
  try {
    const projKey = getProjectKey(id, userId);
    let raw = localStorage.getItem(projKey);
    // Legacy fallback
    if (!raw) {
      raw = localStorage.getItem(`uvs_proj_${id}`);
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function deleteLocalProject(id: string, userId?: string | null): void {
  try {
    const projKey = getProjectKey(id, userId);
    localStorage.removeItem(projKey);
    localStorage.removeItem(`uvs_proj_${id}`); // legacy cleanup

    const indexKey = getIndexKey(userId);
    const list = listLocalProjects(userId).filter((p) => p.id !== id);
    localStorage.setItem(indexKey, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to delete local project:", e);
  }
}

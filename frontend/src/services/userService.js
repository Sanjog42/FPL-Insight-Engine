import { apiFetch } from "./api";

export async function getCurrentUser() {
  return apiFetch("/api/auth/me/");
}

export async function updateCurrentUser(payload) {
  return apiFetch("/api/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload) {
  return apiFetch("/api/auth/change-password/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminWorkflow(modelType) {
  return apiFetch(`/api/admin/ml/workflow/?model_type=${encodeURIComponent(modelType)}`);
}

export async function retrainModel(modelType) {
  return apiFetch("/api/admin/ml/retrain/", {
    method: "POST",
    body: JSON.stringify({ model_type: modelType }),
  });
}

export async function previewDraftModel(id) {
  return apiFetch(`/api/admin/ml/preview/${id}/`);
}

export async function publishDraftModel(id) {
  return apiFetch(`/api/admin/ml/publish/${id}/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rollbackModel(modelType) {
  return apiFetch("/api/admin/ml/rollback/", {
    method: "POST",
    body: JSON.stringify({ model_type: modelType }),
  });
}

export async function getAdminUsers() {
  return apiFetch("/api/admin/users/");
}

export async function promoteUser(userId) {
  return apiFetch(`/api/superadmin/promote/${userId}/`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function demoteUser(userId) {
  return apiFetch(`/api/superadmin/demote/${userId}/`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function deleteUser(userId) {
  return apiFetch(`/api/superadmin/delete/${userId}/`, {
    method: "DELETE",
  });
}

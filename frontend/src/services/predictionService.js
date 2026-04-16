import { apiFetch } from "./api";

export async function getPlayerPointsPrediction(playerId) {
  return apiFetch("/api/predictions/player-points/", {
    method: "POST",
    body: JSON.stringify({ player_id: Number(playerId) }),
  });
}

export async function getCaptaincy(limit = 10) {
  return apiFetch(`/api/predictions/captaincy/?limit=${Number(limit)}`);
}

export async function getMatchUpcoming() {
  return apiFetch("/api/predictions/match-upcoming/");
}

export async function getBootstrap(force = false) {
  return apiFetch(`/api/fpl/bootstrap/${force ? "?force_refresh=1" : ""}`);
}

export async function getPricePrediction(playerId) {
  return apiFetch("/api/predictions/price/", {
    method: "POST",
    body: JSON.stringify({ player_id: Number(playerId) }),
  });
}

export async function getFdrByTeam(teamId) {
  return apiFetch(`/api/predictions/fdr/?team_id=${Number(teamId)}`);
}

export async function getMatchPrediction(homeTeamId, awayTeamId) {
  return apiFetch("/api/predictions/match/", {
    method: "POST",
    body: JSON.stringify({
      home_team_id: Number(homeTeamId),
      away_team_id: Number(awayTeamId),
    }),
  });
}

export async function getTransferSuggestions(payload) {
  return apiFetch("/api/predictions/transfers/suggest/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateTeam(payload) {
  return apiFetch("/api/predictions/team/generate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

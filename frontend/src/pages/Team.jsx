import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../layouts/AppLayout";
import { apiFetch } from "../services/api";

const SLOT_DEFS = [
  { id: "GK1", position: "GK" },
  { id: "GK2", position: "GK" },
  { id: "DEF1", position: "DEF" },
  { id: "DEF2", position: "DEF" },
  { id: "DEF3", position: "DEF" },
  { id: "DEF4", position: "DEF" },
  { id: "DEF5", position: "DEF" },
  { id: "MID1", position: "MID" },
  { id: "MID2", position: "MID" },
  { id: "MID3", position: "MID" },
  { id: "MID4", position: "MID" },
  { id: "MID5", position: "MID" },
  { id: "FWD1", position: "FWD" },
  { id: "FWD2", position: "FWD" },
  { id: "FWD3", position: "FWD" },
];

function emptySlots() {
  return SLOT_DEFS.map((slot) => ({ ...slot, playerId: null, playerName: "" }));
}

export default function Team() {
  useAuthGuard();

  const [remainingBudget, setRemainingBudget] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [generateBudget, setGenerateBudget] = useState(100);
  const [teamSlots, setTeamSlots] = useState(emptySlots());

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [positions, setPositions] = useState([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [search, setSearch] = useState("");

  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const [transferResult, setTransferResult] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [teamStorageKey, setTeamStorageKey] = useState(null);

  const teamMap = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const positionMap = useMemo(() => {
    const map = new Map();
    positions.forEach((p) => map.set(p.id, p));
    return map;
  }, [positions]);

  const playerMap = useMemo(() => {
    const map = new Map();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const selectedPlayerIds = useMemo(() => {
    const ids = new Set();
    teamSlots.forEach((slot) => {
      if (slot.playerId) ids.add(slot.playerId);
    });
    return ids;
  }, [teamSlots]);

  const slotsByPosition = {
    GK: teamSlots.filter((s) => s.position === "GK"),
    DEF: teamSlots.filter((s) => s.position === "DEF"),
    MID: teamSlots.filter((s) => s.position === "MID"),
    FWD: teamSlots.filter((s) => s.position === "FWD"),
  };

  function renderRow(positionKey) {
    const slots = slotsByPosition[positionKey] || [];

    return slots.map((slot) => (
      <div key={slot.id} className="team-slot compact formation-slot">
        <div className="slot-header">
          <span className="slot-pos">{slot.position}</span>
          <span className="slot-id">{slot.id}</span>
        </div>
        <button className="slot-add" type="button" onClick={() => openPicker(slot)}>
          +
        </button>
        <div className="slot-player">
          {slot.playerName ? (
            <>
              <div className="slot-player-name">{slot.playerName}</div>
              <div className="slot-player-meta">
                {slot.teamShort || "-"} | {slot.position} | GBP {slot.cost || "-"}m
              </div>
            </>
          ) : (
            <div className="slot-player-empty">Empty slot</div>
          )}
        </div>
      </div>
    ));
  }

  useEffect(() => {
    let active = true;

    async function loadStoredTeamForUser() {
      try {
        const me = await apiFetch("/api/auth/me/");
        if (!active) return;

        const userId = Number(me?.id || 0);
        const key = userId > 0 ? `fplTeamState:user:${userId}` : null;
        setTeamStorageKey(key);

        if (!key) return;
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        setRemainingBudget(typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0);
        setFreeTransfers(typeof stored.freeTransfers === "number" ? stored.freeTransfers : 1);
        if (Array.isArray(stored.teamSlots) && stored.teamSlots.length === SLOT_DEFS.length) {
          setTeamSlots(stored.teamSlots);
        }
      } catch {
        if (!active) return;
        setTeamStorageKey(null);
      }
    }

    loadStoredTeamForUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadPlayers() {
      setLoadingPlayers(true);
      setPlayerError("");
      try {
        const res = await apiFetch("/api/fpl/bootstrap/", { signal: controller.signal });
        if (!active) return;
        setPlayers(res?.data?.elements || []);
        setTeams(res?.data?.teams || []);
        setPositions(res?.data?.element_types || []);
      } catch (err) {
        if (!active) return;
        setPlayerError(err?.message || "Failed to load players.");
      } finally {
        if (active) setLoadingPlayers(false);
      }
    }

    loadPlayers();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function openPicker(slot) {
    setPickerSlot(slot);
    setSearch("");
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSlot(null);
    setSearch("");
  }

  function hydrateSlotWithPlayer(slot, player, fallback = null) {
    const source = player || fallback;
    if (!source) return slot;
    const team = teamMap.get(source.team) || null;
    const cost = typeof source.now_cost === "number" ? (source.now_cost / 10).toFixed(1) : source.cost?.toFixed?.(1);
    return {
      ...slot,
      playerId: source.id,
      playerName:
        (`${source.first_name || ""} ${source.second_name || ""}`.trim() || source.web_name || source.name || "").trim(),
      teamId: source.team || source.team_id,
      teamShort: team?.short_name || source.team_name || team?.name || "",
      elementType: source.element_type || null,
      cost: cost || "",
    };
  }

  function selectPlayer(slotId, player) {
    const currentOwner = teamSlots.find((s) => s.playerId === player.id);
    if (currentOwner && currentOwner.id !== slotId) {
      alert(`${player.web_name || player.second_name} is already selected in ${currentOwner.id}.`);
      return;
    }

    setTeamSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? hydrateSlotWithPlayer(slot, player) : slot))
    );
    closePicker();
  }

  const filteredPlayers = useMemo(() => {
    if (!pickerSlot) return [];
    const q = search.trim().toLowerCase();
    const targetPos = pickerSlot.position;

    return players
      .filter((p) => {        const typePosMap = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
        const mappedByType = typePosMap[Number(p.element_type)] || "";
        const pos = positionMap.get(p.element_type);
        const mappedByMeta = ((pos?.singular_name_short || "").toUpperCase() || "").replace("GKP", "GK");
        const normalizedPos = mappedByType || mappedByMeta;
        if (normalizedPos !== targetPos) return false;

        const owner = teamSlots.find((s) => s.playerId === p.id);
        if (owner && owner.id !== pickerSlot.id) return false;

        if (!q) return true;
        const team = teamMap.get(p.team);
        const teamName = `${team?.short_name || ""} ${team?.name || ""}`.toLowerCase();
        const name = `${p.first_name || ""} ${p.second_name || ""} ${p.web_name || ""}`.toLowerCase();
        return name.includes(q) || teamName.includes(q);
      })
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [players, pickerSlot, positionMap, teamMap, teamSlots, search]);

  function save() {
    if (!teamStorageKey) {
      alert("Unable to resolve current user. Please re-login.");
      return;
    }

    const data = {
      remainingBudget,
      freeTransfers,
      teamSlots,
      teamStored: true,
      storedAt: new Date().toISOString(),
    };
    localStorage.setItem(teamStorageKey, JSON.stringify(data));
    alert("Team state saved for this user.");
  }

  function validateFullTeam() {
    if (teamSlots.some((s) => !s.playerId)) {
      return "Fill all 15 slots before requesting transfer suggestions.";
    }
    if (selectedPlayerIds.size !== 15) {
      return "Your squad contains duplicate players.";
    }
    return "";
  }

  async function suggestTransfers() {
    const validation = validateFullTeam();
    if (validation) {
      alert(validation);
      return;
    }

    setLoadingTransfers(true);
    setPlayerError("");
    setTransferResult(null);

    try {
      const payload = {
        remaining_budget: Number(remainingBudget || 0),
        free_transfers: Number(freeTransfers || 1),
        team_slots: teamSlots.map((slot) => ({
          slot_id: slot.id,
          position: slot.position,
          player_id: Number(slot.playerId),
        })),
      };

      const res = await apiFetch("/api/predictions/transfers/suggest/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTransferResult(res);
      setRemainingBudget(res?.remaining_budget ?? remainingBudget);
    } catch (err) {
      setPlayerError(err?.message || "Failed to get transfer suggestions.");
    } finally {
      setLoadingTransfers(false);
    }
  }

  function applyTransfer(suggestion) {
    const incoming = playerMap.get(suggestion?.in?.id);
    setTeamSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== suggestion.slot_id) return slot;
        return hydrateSlotWithPlayer(slot, incoming, {
          id: suggestion.in.id,
          name: suggestion.in.name,
          team_name: suggestion.in.team_name,
          cost: suggestion.in.cost,
        });
      })
    );
    if (typeof suggestion?.bank_after === "number") {
      setRemainingBudget(suggestion.bank_after);
    }
  }

  function applyGeneratedTeam(generatedTeam, nextBudget) {
    const grouped = { GK: [], DEF: [], MID: [], FWD: [] };
    generatedTeam.forEach((p) => {
      if (grouped[p.position]) grouped[p.position].push(p);
    });

    const next = SLOT_DEFS.map((slot) => {
      const pick = grouped[slot.position]?.shift();
      if (!pick) return { ...slot, playerId: null, playerName: "" };
      const fromBootstrap = playerMap.get(pick.id);
      return hydrateSlotWithPlayer(slot, fromBootstrap, pick);
    });

    setTeamSlots(next);
    if (typeof nextBudget === "number") setRemainingBudget(nextBudget);
  }

  async function generateFullTeam() {
    setLoadingGenerate(true);
    setPlayerError("");
    setGenerateResult(null);

    try {
      const res = await apiFetch("/api/predictions/team/generate/", {
        method: "POST",
        body: JSON.stringify({ budget: Number(generateBudget || 100) }),
      });
      setGenerateResult(res);
      applyGeneratedTeam(res?.team || [], res?.remaining_budget);
    } catch (err) {
      setPlayerError(err?.message || "Failed to generate team.");
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <AppLayout
      title="Store My Team"
      subtitle="Position-based squad picker with ML transfer and full-team recommendations."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Team State</h3>
            <span className="badge badge-accent">Budget + Transfers</span>
          </div>

          <div className="grid grid-3" style={{ marginTop: "1rem" }}>
            <div>
              <label className="text-muted">Remaining Budget (GBP M)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                value={remainingBudget}
                onChange={(e) => setRemainingBudget(parseFloat(e.target.value || "0"))}
              />
            </div>
            <div>
              <label className="text-muted">Free Transfers</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={freeTransfers}
                onChange={(e) => setFreeTransfers(parseInt(e.target.value || "1", 10))}
              />
            </div>
            <div>
              <label className="text-muted">Generate Team Budget</label>
              <input
                className="input"
                type="number"
                min={80}
                max={130}
                step="0.1"
                value={generateBudget}
                onChange={(e) => setGenerateBudget(parseFloat(e.target.value || "100"))}
              />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button className="btn btn-outline" onClick={save} type="button">
              Save Team State
            </button>
            <button className="btn btn-accent" onClick={suggestTransfers} type="button" disabled={loadingTransfers}>
              {loadingTransfers ? "Suggesting..." : "Suggest Transfers (ML)"}
            </button>
            <button className="btn btn-outline" onClick={generateFullTeam} type="button" disabled={loadingGenerate}>
              {loadingGenerate ? "Generating..." : "Generate Full Team (ML)"}
            </button>
          </div>

          {playerError ? <p style={{ color: "#ef4444" }}>{playerError}</p> : null}
          {loadingPlayers ? <p className="text-muted">Loading bootstrap players...</p> : null}
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">15 Player Slots</h3>
            <span className="badge badge-soft">Position Locked + Button</span>
          </div>

          <div className="team-formation" style={{ marginTop: "1rem" }}>
            <div className="formation-row">{renderRow("GK")}</div>
            <div className="formation-row">{renderRow("DEF")}</div>
            <div className="formation-row">{renderRow("MID")}</div>
            <div className="formation-row">{renderRow("FWD")}</div>
          </div>
        </div>
      </section>

      {transferResult?.suggestions?.length ? (
        <section className="section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">ML Transfer Suggestions</h3>
              <span className="badge badge-accent">{transferResult.model}</span>
            </div>

            <div className="grid grid-2" style={{ marginTop: "1rem" }}>
              {transferResult.suggestions.map((sug) => (
                <div key={`${sug.slot_id}-${sug.in.id}`} className="player-card">
                  <div className="player-row">
                    <div>
                      <strong>{sug.position} | {sug.slot_id}</strong>
                      <div className="text-muted">Expected gain: +{sug.expected_gain} pts</div>
                    </div>
                    <button className="btn btn-outline" type="button" onClick={() => applyTransfer(sug)}>
                      Apply
                    </button>
                  </div>
                  <div className="compare-stats" style={{ marginTop: "0.75rem" }}>
                    <div className="compare-row"><span>Out</span><span>{sug.out.name} ({sug.out.team_name}) | {sug.out.cost}m</span></div>
                    <div className="compare-row"><span>In</span><span>{sug.in.name} ({sug.in.team_name}) | {sug.in.cost}m</span></div>
                    <div className="compare-row"><span>Bank After</span><span>{sug.bank_after}m</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {generateResult?.team?.length ? (
        <section className="section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Generated Full Team</h3>
              <span className="badge badge-soft">Cost: {generateResult.total_cost}m</span>
            </div>
            <div className="inline-note">
              Captain: {generateResult?.captain?.name} ({generateResult?.captain?.predicted_points} pts)
            </div>
          </div>
        </section>
      ) : null}

      {pickerOpen && pickerSlot ? (
        <div className="picker-backdrop" onClick={closePicker}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ marginBottom: "0.5rem" }}>
              <h3 className="card-title">Pick {pickerSlot.position}</h3>
              <button type="button" className="pill" onClick={closePicker}>Close</button>
            </div>

            <input
              className="input"
              placeholder={`Search ${pickerSlot.position} by name/team...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="picker-list" style={{ marginTop: "0.75rem" }}>
              {filteredPlayers.map((p) => {
                const t = teamMap.get(p.team);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="picker-item"
                    onClick={() => selectPlayer(pickerSlot.id, p)}
                  >
                    <span>{`${p.first_name || ""} ${p.second_name || ""}`.trim() || p.web_name}</span>
                    <span className="text-muted">{t?.short_name || t?.name || "-"} | {(p.now_cost / 10).toFixed(1)}m</span>
                  </button>
                );
              })}
              {!filteredPlayers.length ? (
                <p className="text-muted">No {pickerSlot.position} players found for this search.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}









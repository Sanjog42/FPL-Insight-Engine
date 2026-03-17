import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

export default function Team() {
  useAuthGuard();

  const slotDefs = [
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

  const [remainingBudget, setRemainingBudget] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState(0);
  const [teamSlots, setTeamSlots] = useState(
    slotDefs.map((slot) => ({ ...slot, playerName: "" }))
  );
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [positions, setPositions] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const slotsByPosition = {
    GK: teamSlots.filter((s) => s.position === "GK"),
    DEF: teamSlots.filter((s) => s.position === "DEF"),
    MID: teamSlots.filter((s) => s.position === "MID"),
    FWD: teamSlots.filter((s) => s.position === "FWD"),
  };

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

  function renderRow(positionKey, totalCols, fillCount, offsetLeft = 0) {
    const slots = slotsByPosition[positionKey];
    const cells = [];
    const emptyBefore = Math.max(0, offsetLeft);
    const emptyAfter = Math.max(0, totalCols - emptyBefore - fillCount);

    for (let i = 0; i < emptyBefore; i += 1) {
      cells.push(
        <div key={`${positionKey}-empty-b-${i}`} className="slot-empty" />
      );
    }

    for (let i = 0; i < fillCount; i += 1) {
      const slot = slots[i];
      if (!slot) continue;
      cells.push(
        <div key={slot.id} className="team-slot compact">
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
                  {slot.teamShort || "—"} · {slot.position}
                </div>
              </>
            ) : (
              <div className="slot-player-empty">Empty slot</div>
            )}
          </div>
        </div>
      );
    }

    for (let i = 0; i < emptyAfter; i += 1) {
      cells.push(
        <div key={`${positionKey}-empty-a-${i}`} className="slot-empty" />
      );
    }

    return cells;
  }

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("fplTeamState") || "{}");
    setRemainingBudget(typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0);
    setFreeTransfers(typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0);
    if (Array.isArray(stored.teamSlots) && stored.teamSlots.length === slotDefs.length) {
      setTeamSlots(stored.teamSlots);
    }
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

  function selectPlayer(slotId, player) {
    const team = teamMap.get(player.team);
    const teamShort = team?.short_name || team?.name || "";
    setTeamSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              playerId: player.id,
              playerName: `${player.first_name} ${player.second_name}`.trim() || player.web_name,
              teamId: player.team,
              teamShort,
              elementType: player.element_type,
            }
          : slot
      )
    );
    closePicker();
  }

  const filteredPlayers = useMemo(() => {
    if (!pickerSlot) return [];
    const q = search.trim().toLowerCase();
    const targetPos = pickerSlot.position;
    return players
      .filter((p) => {
        const pos = positionMap.get(p.element_type);
        const posShort = (pos?.singular_name_short || "").toUpperCase();
        if (posShort !== targetPos) return false;
        if (!q) return true;
        const team = teamMap.get(p.team);
        const teamName = `${team?.short_name || ""} ${team?.name || ""}`.toLowerCase();
        const name = `${p.first_name || ""} ${p.second_name || ""} ${p.web_name || ""}`.toLowerCase();
        return name.includes(q) || teamName.includes(q);
      })
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [players, pickerSlot, positionMap, teamMap, search]);

  function save() {
    const data = {
      remainingBudget,
      freeTransfers,
      teamSlots,
      teamStored: true,
      storedAt: new Date().toISOString(),
    };
    localStorage.setItem("fplTeamState", JSON.stringify(data));
    alert("Team state saved.");
  }

  return (
    <AppLayout
      title="Store My Team"
      subtitle="Save your budget, free transfers, and squad data (currently local mock)."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Team State</h3>
            <span className="badge badge-accent">LocalStorage</span>
          </div>

          <div className="grid grid-2" style={{ marginTop: "1rem" }}>
            <div>
              <label className="text-muted">Remaining Budget (Â£M)</label>
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
                value={freeTransfers}
                onChange={(e) => setFreeTransfers(parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn-outline" onClick={save}>
              Save Team State
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">15 Player Slots</h3>
            <span className="badge badge-soft">By Position</span>
          </div>

          <div className="team-formation" style={{ marginTop: "1rem" }}>
            <div className="formation-row">
              {renderRow("GK", 5, 2, 1)}
            </div>
            <div className="formation-row">
              {renderRow("DEF", 5, 5, 0)}
            </div>
            <div className="formation-row">
              {renderRow("MID", 5, 5, 0)}
            </div>
            <div className="formation-row">
              {renderRow("FWD", 5, 3, 1)}
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}





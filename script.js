// Use config.apiKey if available, otherwise fallback (though config.js should be loaded)
const apiKey = typeof config !== 'undefined' ? config.apiKey : '3';
const API = `https://www.thesportsdb.com/api/v1/json/${apiKey}/`;

const teamsContainer = document.getElementById("teams");
const detailsContainer = document.getElementById("details");
const matchListContainer = document.getElementById("match-list");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");
const playerResultsContainer = document.getElementById("player-results");
const errorContainer = document.getElementById("error-container");
const loadingIndicator = document.getElementById("loading-indicator");
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;
const favoritesBar = document.getElementById('favorites-bar');

let teams = [];
let allMatches = [];

// --- UI STATE MANAGEMENT ---

function showLoading() {
    loadingIndicator.classList.remove('hidden');
    errorContainer.classList.add('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
    hideLoading();
}

function clearError() {
    errorContainer.classList.add('hidden');
}

// --- INPUT VALIDATION ---

function validateInput(query) {
    const trimmed = query.trim();
    if (!trimmed) {
        showError("Please enter a search term.");
        return false;
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
        showError("Invalid characters in search.");
        return false;
    }
    return true;
}

// --- THEME TOGGLE ---

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
});

// --- FETCH FUNCTIONS ---

// FETCH NBA TEAMS
async function fetchTeams() {
  showLoading();
  try {
    const res = await fetch(`${API}search_all_teams.php?l=NBA`);
    if (!res.ok) throw new Error("Failed to fetch teams");
    
    const data = await res.json();
    if (!data.teams) throw new Error("No teams found");

    teams = data.teams;
    displayTeams(getSortedTeams(), true);
  } catch (error) {
    console.error("Error fetching teams:", error);
    showError("Failed to load teams. Please try again later.");
  } finally {
    hideLoading();
  }
}

let teamsShown = 0;
const TEAMS_PER_PAGE = 6;

function displayTeams(list, reset = true) {
  if (reset) {
    teamsContainer.innerHTML = "";
    teamsShown = 0;
  }
  if (!list || list.length === 0) {
      teamsContainer.innerHTML = "<p>No teams found.</p>";
      const btn = document.getElementById('load-more-teams');
      if (btn) btn.style.display = 'none';
      return;
  }
  const end = Math.min(teamsShown + TEAMS_PER_PAGE, list.length);
  for (let i = teamsShown; i < end; i++) {
    const team = list[i];
    const div = document.createElement("div");
    div.className = "team-card";
    const imgUrl = team.strBadge || team.strLogo || 'https://via.placeholder.com/100?text=No+Logo';
    // Add star button for favorite
    const isFav = isTeamFavorite(team.idTeam);
    div.innerHTML = `
      <img src="${imgUrl}" alt="${team.strTeam}" />
      <h3>${team.strTeam}
        <button class="team-fav-star${isFav ? ' favorited' : ''}" title="Favorite" onclick="event.stopPropagation(); toggleFavoriteTeam('${team.idTeam}', '${team.strTeam}')">★</button>
      </h3>
      <p>${team.strStadium || ''}</p>
    `;
    div.onclick = () => {
        loadTeamDetails(team.idTeam);
        detailsContainer.scrollIntoView({ behavior: 'smooth' });
    };
    teamsContainer.appendChild(div);
  }
  teamsShown = end;
  // Show or hide the Load More button
  const loadMoreBtn = document.getElementById('load-more-teams');
  if (loadMoreBtn) {
    if (teamsShown < list.length) {
      loadMoreBtn.style.display = '';
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }
}

const loadMoreTeamsBtn = document.getElementById('load-more-teams');
if (loadMoreTeamsBtn) {
  loadMoreTeamsBtn.addEventListener('click', function() {
    displayTeams(teams, false);
  });
}

// TEAM DETAILS + PLAYERS
async function loadTeamDetails(teamId) {
  detailsContainer.innerHTML = "";
  showLoading();
  detailsContainer.style.display = "block";

  try {
    // Find team in local data instead of fetching again (avoids API issues)
    const team = teams.find(t => t.idTeam === teamId);
    
    // Only fetch players
    const playerRes = await fetch(`${API}lookup_all_players.php?id=${teamId}`);
    const playerData = await playerRes.json();
    let players = playerData.player || [];

    // --- FIX: REMOVE INCORRECT PLAYERS (API DATA ERRORS) ---
    // The free API sometimes lists players in the wrong teams.
    if (teamId === "134865") { // Golden State Warriors
        players = players.filter(p => p.strPlayer !== "Al Horford");
    }
    // -------------------------------------------------------

    // --- FIX: MANUALLY ADD MISSING STARS (API LIMIT WORKAROUND) ---
    // The free API limits rosters to 10 players. We manually fetch stars if they are missing.
    const missingStars = {
        "134865": ["Stephen Curry", "Draymond Green"], // Golden State Warriors
        "134867": ["LeBron James", "Anthony Davis"],   // LA Lakers
        "134860": ["Jayson Tatum", "Jaylen Brown"],    // Boston Celtics
        "134880": ["Trae Young"]                       // Atlanta Hawks
    };

    if (missingStars[teamId]) {
        for (const starName of missingStars[teamId]) {
            // Check if already in list
            if (!players.find(p => p.strPlayer === starName)) {
                try {
                    const starRes = await fetch(`${API}searchplayers.php?p=${starName}`);
                    const starData = await starRes.json();
                    if (starData.player && starData.player[0]) {
                        // Get FULL details (search endpoint misses height/weight)
                        const starId = starData.player[0].idPlayer;
                        const fullRes = await fetch(`${API}lookupplayer.php?id=${starId}`);
                        const fullData = await fullRes.json();
                        
                        if (fullData.players && fullData.players[0]) {
                             players.unshift(fullData.players[0]);
                        }
                    }
                } catch (e) {
                    console.log(`Could not fetch star: ${starName}`);
                }
            }
        }
    }
    // -----------------------------------------------------------

    let playersHtml = '<div class="players-grid">';
    players.forEach(p => {
        const pImg = p.strCutout || p.strThumb || 'https://via.placeholder.com/100?text=Player';
        
        // Format Height/Weight nicely
        const height = p.strHeight ? p.strHeight.replace(/m/g, '') : 'N/A';
        const weight = p.strWeight ? p.strWeight.replace(/kg/g, ' lbs') : 'N/A';

        playersHtml += `
            <div class="player-card">
                <img src="${pImg}" alt="${p.strPlayer}">
                <h4>${p.strPlayer}</h4>
                <p class="position">${p.strPosition}</p>
                <div class="player-stats">
                    <div class="stat-box">
                        <span class="label">Height</span>
                        <span class="value">${height}</span>
                    </div>
                    <div class="stat-box">
                        <span class="label">Weight</span>
                        <span class="value">${weight}</span>
                    </div>
                </div>
            </div>
        `;
    });
    playersHtml += '</div>';

    // Filter matches for this team
    const teamMatches = allMatches.filter(m => m.idHomeTeam === teamId || m.idAwayTeam === teamId).reverse().slice(0, 5);
    
    let matchesHtml = '';
    if (teamMatches.length > 0) {
        matchesHtml = '<h3>Recent Matches</h3><div class="team-matches-list">';
        teamMatches.forEach(m => {
             matchesHtml += `
                <div class="match-row">
                    <span class="date">${m.dateEvent}</span>
                    <span class="vs">${m.strHomeTeam} <span class="vs-text">vs</span> ${m.strAwayTeam}</span>
                    <span class="score">${m.intHomeScore} - ${m.intAwayScore}</span>
                </div>
             `;
        });
        matchesHtml += '</div>';
    }

    detailsContainer.innerHTML = `
      <button onclick="closeDetails()" class="close-btn">Close Details</button>
      <div class="team-header">
        <img src="${team.strBadge || team.strLogo}" class="team-logo-large">
        <div>
            <h2>${team.strTeam}</h2>
            <p>${team.strDescriptionEN ? team.strDescriptionEN.slice(0, 400) + '...' : 'No description available.'}</p>
            <p><strong>Stadium:</strong> ${team.strStadium}, ${team.strLocation}</p>
        </div>
      </div>

      ${matchesHtml}

      <h3>Team Roster (Partial - API Limit)</h3>
      ${playersHtml}
    `;
  } catch (error) {
    detailsContainer.innerHTML = "<p>Error loading details.</p>";
    console.error(error);
    showError("Failed to load team details.");
  } finally {
      hideLoading();
  }
}

function closeDetails() {
    detailsContainer.innerHTML = "";
    detailsContainer.style.display = "none";
}

// --- FAVORITES LOGIC ---
function getFavoriteTeams() {
  return JSON.parse(localStorage.getItem('nba-favorite-teams') || '[]');
}
function saveFavoriteTeams(favs) {
  localStorage.setItem('nba-favorite-teams', JSON.stringify(favs));
}
function isTeamFavorite(teamId) {
  return getFavoriteTeams().includes(teamId);
}
function toggleFavoriteTeam(teamId, teamName) {
  let favs = getFavoriteTeams();
  if (favs.includes(teamId)) {
    favs = favs.filter(id => id !== teamId);
  } else {
    favs.push(teamId);
  }
  saveFavoriteTeams(favs);
  renderFavoritesBar();
  displayTeams(teams, true);
}
function renderFavoritesBar() {
  const favs = getFavoriteTeams();
  favoritesBar.innerHTML = '';
  if (favs.length === 0) return;
  favs.forEach(teamId => {
    const team = teams.find(t => t.idTeam === teamId);
    if (team) {
      const btn = document.createElement('button');
      btn.textContent = team.strTeam;
      btn.className = 'favorite-team-btn';
      btn.onclick = () => {
        // Scroll to team card or show details
        loadTeamDetails(team.idTeam);
        detailsContainer.scrollIntoView({ behavior: 'smooth' });
      };
      favoritesBar.appendChild(btn);
    }
  });
}
// --- END FAVORITES LOGIC ---

// SEARCH
let searchTimeout;

// Search Button Click
searchBtn.addEventListener("click", () => {
    const query = searchInput.value;
    if (validateInput(query)) {
        performSearch(query);
    }
});

// Enter Key Press
searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const query = searchInput.value;
        if (validateInput(query)) {
            performSearch(query);
        }
    }
});

// Live Search (Debounced)
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  clearError();
  
  // Filter Teams (Local)
  const filteredTeams = teams.filter(team =>
    team.strTeam.toLowerCase().includes(query)
  );
  displayTeams(filteredTeams);

  // Search Players (API) - Debounced
  clearTimeout(searchTimeout);
  if (query.length > 2) {
      searchTimeout = setTimeout(() => searchPlayers(query), 500);
  } else {
      playerResultsContainer.innerHTML = "";
  }
});

function performSearch(query) {
    // Trigger both local filter and API search
    const lowerQuery = query.toLowerCase();
    const filteredTeams = teams.filter(team =>
        team.strTeam.toLowerCase().includes(lowerQuery)
    );
    displayTeams(filteredTeams);
    searchPlayers(lowerQuery);
}

async function searchPlayers(query) {
    showLoading();
    try {
        const res = await fetch(`${API}searchplayers.php?p=${query}`);
        const data = await res.json();
        displayPlayerResults(data.player);
    } catch (error) {
        console.error("Error searching players:", error);
        showError("Error searching for players.");
    } finally {
        hideLoading();
    }
}

function displayPlayerResults(players) {
    playerResultsContainer.innerHTML = "";
    if (!players) {
        // Only show "No results" if we explicitly searched via button/enter, 
        // but for live search we might just want to clear.
        // For now, let's just return.
        return;
    }

    // Filter only basketball players to avoid noise
    const nbaPlayers = players.filter(p => p.strSport === "Basketball");

    if (nbaPlayers.length > 0) {
        playerResultsContainer.innerHTML = "<h3>Player Results</h3><div class='players-grid'></div>";
        const grid = playerResultsContainer.querySelector(".players-grid");
        
        nbaPlayers.forEach(p => {
            const div = document.createElement("div");
            div.className = "player-card";
            const pImg = p.strCutout || p.strThumb || 'https://via.placeholder.com/100?text=Player';
            div.innerHTML = `
                <img src="${pImg}" alt="${p.strPlayer}">
                <h4>${p.strPlayer}</h4>
                <p>${p.strTeam}</p>
            `;
            div.onclick = () => showPlayerDetails(p);
            grid.appendChild(div);
        });
    } else {
        // Optional: Show no players found message
    }
}

async function showPlayerDetails(p) {
    detailsContainer.style.display = "block";
    detailsContainer.innerHTML = "";
    showLoading();
    detailsContainer.scrollIntoView({ behavior: 'smooth' });

    let player = p;
    // If height is missing, fetch full details
    if (!player.strHeight && player.idPlayer) {
        try {
            const res = await fetch(`${API}lookupplayer.php?id=${player.idPlayer}`);
            const data = await res.json();
            if (data.players && data.players[0]) {
                player = data.players[0];
            }
        } catch (e) {
            console.error("Error fetching full player details", e);
        }
    }

    const height = player.strHeight ? player.strHeight.replace(/m/g, '') : 'N/A';
    const weight = player.strWeight ? player.strWeight.replace(/kg/g, ' lbs') : 'N/A';

    detailsContainer.innerHTML = `
        <button onclick="closeDetails()" class="close-btn">Close</button>
        <div class="team-header">
            <img src="${player.strCutout || player.strThumb}" class="player-detail-large" style="object-fit: contain;">
            <div>
                <h2>${player.strPlayer}</h2>
                <p><strong>Team:</strong> ${player.strTeam}</p>
                <p><strong>Position:</strong> ${player.strPosition}</p>
                <p><strong>Height:</strong> ${height} | <strong>Weight:</strong> ${weight}</p>
                <p>${player.strDescriptionEN ? player.strDescriptionEN.slice(0, 500) + '...' : ''}</p>
            </div>
        </div>
    `;
    hideLoading();
}

// MATCH RESULTS
async function fetchMatchResults() {
  try {
    // Fetch matches for the 2025-2026 season
    const res = await fetch(`${API}eventsseason.php?id=4387&s=2025-2026`);
    const data = await res.json();
    const matches = data.events;
    
    if (matches) {
        // Store globally for team filtering
        allMatches = matches.filter(m => m.intHomeScore !== null);
        
        // Sort by date descending (newest first)
        const recentMatches = [...allMatches].reverse(); 

        displayMatches(recentMatches);
    } else {
        matchListContainer.innerHTML = "<p>No recent matches found.</p>";
    }
  } catch (error) {
    console.error("Error fetching match results:", error);
    matchListContainer.innerHTML = "<p>Error loading matches.</p>";
  }
}

function displayMatches(matches) {
    matchListContainer.innerHTML = "";
    // Show last 10 matches
    matches.slice(0, 10).forEach(match => {
        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            <div class="match-teams">
                <span class="home">${match.strHomeTeam}</span>
                <span class="vs">vs</span>
                <span class="away">${match.strAwayTeam}</span>
            </div>
            <div class="match-score">
                ${match.intHomeScore} - ${match.intAwayScore}
            </div>
            <div class="match-date">${match.dateEvent}</div>
        `;
        matchListContainer.appendChild(div);
    });
}

// SORTING AND FILTERING
let teamsSort = 'default';

const sortTeamsSelect = document.getElementById('sort-teams');

if (sortTeamsSelect) {
  sortTeamsSelect.addEventListener('change', function() {
    teamsSort = this.value;
    displayTeams(getSortedTeams(), true);
  });
}

function getSortedTeams() {
  let arr = [...teams];
  // Sort
  if (teamsSort === 'name-asc') {
    arr.sort((a, b) => a.strTeam.localeCompare(b.strTeam));
  } else if (teamsSort === 'name-desc') {
    arr.sort((a, b) => b.strTeam.localeCompare(a.strTeam));
  }
  return arr;
}

// INIT
fetchTeams();
fetchMatchResults();
renderFavoritesBar();


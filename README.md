# 🏀 NBA Dashboard

A web app that fetches and displays NBA data for teams, players, and games.

## 🚀 Features

- Search NBA teams, players, or games
- Display results in cards or tables
- Error handling for failed requests
- Responsive design for desktop and mobile

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- [TheSportsDB API](https://www.thesportsdb.com/api.php)

## 📦 Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/your-username/nba-api-project.git
   ```
2. **Navigate to the NBA_Api folder**
   ```sh
   cd nba-api-project/NBA_Api
   ```
3. **Open `index.html` in your web browser**
   - Double-click `index.html` or right-click and select “Open with” > your browser.

## 🖥️ How to Use

1. Open `index.html` in your web browser.
2. Enter a team, player, or game in the search box and click **Search**.
3. View results and details on the dashboard.

## 📄 License

This project is open source and free to use.

## 🙏 Credits

Created by Ivan, December 2025.

---

## 📚 API Reference (TheSportsDB)

**Base URL:** `https://www.thesportsdb.com/api/v1/json/{APIKEY}/`

**Endpoints:**
- `/searchplayers.php?p={playername}` — Player information
- `/searchteams.php?t={teamname}` — Team information
- `/eventslast.php?id={teamid}` — Last events for a team

**Required Parameters:**
- `p`: Player name
- `t`: Team name
- `id`: Team ID
- `{APIKEY}`: Your unique API Key (or use `1` for public demo)

**Authentication:**
- API Key via URL path (`/api/v1/json/{APIKEY}/`)

**Sample JSON Response (Player):**
```json
{
  "player": [
    {
      "idPlayer": "34145937",
      "strPlayer": "LeBron James",
      "strTeam": "Los Angeles Lakers",
      "strPosition": "Small Forward"
    }
  ]
}
```

![CI](https://github.com/aidai87/manas-menu-back/.github/workflows/update_menu.yml/badge.svg)

# back-manas

Backend for Manas University cafeteria menu. Scrapes the daily cafeteria menu and kiraathane (cafe) menu from [beslenme.manas.edu.kg](https://beslenme.manas.edu.kg) and serves it as a JSON API with translations in Turkish, Russian, and English.

## Prerequisites

- **Node.js** v18 or higher (the project uses ES modules and the `--watch` flag)

## Installing Node.js

### macOS

Using Homebrew:

```bash
brew install node
```

Or using the official installer — download from [nodejs.org](https://nodejs.org/) and run the `.pkg` file.

### Ubuntu / Debian

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Windows

Download the installer from [nodejs.org](https://nodejs.org/) and run it. This will install both Node.js and npm.

### Verify installation

```bash
node -v
npm -v
```

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd back-manas
```

2. Install dependencies:

```bash
npm install
```

## Running

Development mode (auto-restart on file changes):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The server starts on `http://localhost:3000` by default. Set the `PORT` environment variable to change it:

```bash
PORT=8080 npm start
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /menu` | Weekly cafeteria menu with food names (tr/ru/en) and calorie info |
| `GET /kiraathane` | Kiraathane (cafe) menu with categories and prices (KGS) |
| `GET /health` | Health check |

### Example: `GET /menu`

```json
{
  "foods": [
    {
      "id": "mercimek_corbasi",
      "name": {
        "tr": "Mercimek Çorbası",
        "ru": "Чечевичный суп",
        "en": "Lentil Soup"
      },
      "caloriesKcal": 150
    }
  ],
  "menus": [
    {
      "date": "2025-02-10",
      "items": ["mercimek_corbasi", "izgara_tavuk", "pirinc_pilavi"]
    }
  ],
  "meta": {
    "timezone": "Asia/Bishkek",
    "source": "manas_kantin",
    "lastUpdated": "2025-02-10T12:00:00.000Z"
  }
}
```

### Example: `GET /kiraathane`

```json
{
  "categories": [
    {
      "id": "hot_drinks",
      "title": "Горячие напитки",
      "items": [
        { "id": "cay", "name": "ÇAY", "price": 20 }
      ]
    }
  ],
  "meta": {
    "timezone": "Asia/Bishkek",
    "currency": "KGS",
    "lastUpdated": "2025-02-10T12:00:00.000Z"
  }
}
```

## Tech Stack

- **Express** — HTTP server
- **Axios** — HTTP client for scraping
- **Cheerio** — HTML parsing

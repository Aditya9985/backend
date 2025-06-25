# DevMeUp Backend API

Backend server for the DevMeUp application, providing API endpoints for user history and data management.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a .env file with the following variables:
```
DATABASE_URL=your_neon_db_url
PORT=4000
```

3. Run the server:
```bash
npm start
```

## API Endpoints

### History

- `GET /api/history/:userId` - Get user's history
- `POST /api/history` - Create new history entry

### Health Check

- `GET /api/ping` - Check server and database health

## Database

The application uses Neon PostgreSQL for data storage.

## Environment Variables

- `DATABASE_URL`: Neon PostgreSQL connection string
- `PORT`: Server port (default: 4000)

## Scripts

- `npm start`: Start the server
- `npm run migrate`: Run database migrations

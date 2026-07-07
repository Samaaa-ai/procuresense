# ProcureSense — AI-Powered Inventory & Procurement Management

ProcureSense is a modern inventory control system tailored for SME cleaning/hygiene product distributors.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS v4, Recharts, Lucide Icons
- **Backend**: Node.js, Express
- **Database**: PostgreSQL

---

## Directory Structure
```
/procuresense
  ├── /client         # React + Vite frontend
  └── /server         # Node.js + Express backend
```

---

## Database Initialization
1. Ensure **PostgreSQL** is running.
2. In your PostgreSQL instance, create a database named `procuresense` (or configure via environment variables).
3. The server seeding script will automatically check for and create the database if it doesn't exist under your user credentials.

---

## Setup & Running Instructions

### 1. Server Configuration & Seeding
1. Open a terminal and navigate to the `/server` directory:
   ```bash
   cd server
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Configure your database credentials. Create a `.env` file by copying the template:
   ```bash
   copy .env.example .env
   ```
   Edit `.env` to match your local PostgreSQL configuration:
   ```env
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_DATABASE=procuresense
   PORT=5000
   ```
4. Run the database migrations & seeding script:
   ```bash
   npm run db:seed
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend API will run on `http://localhost:5000`.

### 2. Client Setup
1. Open a new terminal and navigate to the `/client` directory:
   ```bash
   cd client
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser to the URL printed in the terminal (usually `http://localhost:5173`).

---

## Quick Demo Script

Follow these 3-4 exact steps to show off the AI reorder suggestion and natural language query features live:

### Step 1: Point Out the Compelling Dashboard State
- **Click 1**: Navigate to the **Dashboard** (which loads by default). Point out the **Critical Alerts** panel on the right side. Three high-urgency items (`Instant Hand Sanitizer Gel`, `Hospital Grade Disinfectant Spray`, and `3-Ply Disposable Face Masks`) are visible in red directly on the screen without scrolling. They are flagged because they are low in stock and expiring in the next 3 days.

### Step 2: Try the AI Natural Language Query Feature
- **Click 2**: Scroll down slightly to the **AI Copilot Natural Language Query** input box at the bottom of the Dashboard. Type the following query:
  > *Which products are low on stock and have batches expiring in 3 days?*
  Click **Ask Copilot**. Point out how the AI Copilot queries the database and dynamically provides a plain-English summary citing exact quantities, SKUs, and expiration states.

### Step 3: View AI Reorder Suggestions & Generate a Draft PO
- **Click 3**: Click on **AI Copilot** in the sidebar. Point out the intelligence cards sorted by urgency. The AI has automatically recommended optimal reorder sizes using sales velocities.
- **Click 4**: Locate the card for **Instant Hand Sanitizer Gel** (high urgency) and click **Draft PO**. Review the generated Purchase Order draft inside the modal and click **Confirm & Send PO** to show the automated procurement dispatch workflow.

---

## Deployment

When deploying the ProcureSense application to a production hosting platform (e.g., Render, Heroku, AWS, or Vercel), ensure you configure the environment variables correctly on your hosting dashboard:

### Required Production Environment Variables

1. **`DATABASE_URL`**:
   - **Description**: The full connection string for your production PostgreSQL database instance.
   - **Example**: `postgresql://db_user:db_password@prod-db-host.com:5432/procuresense`
   - **Usage**: The Express server uses this URL to establish a secure database connection pool in hosted environments.

2. **`GEMINI_API_KEY`**:
   - **Description**: Your production API key from Google AI Studio.
   - **Usage**: Enables the AI Copilot to run real-time queries and generate inventory reorder suggestions.

3. **`PORT`**:
   - **Description**: The port number on which the web server will run (default is `5000` if not specified).
   - **Usage**: Hosted platforms usually allocate this port dynamically.

Ensure these values are set in the application's settings or configuration panel of your provider rather than in a raw `.env` file to maintain proper security compliance.

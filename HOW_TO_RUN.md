# How to Run the LinkedIn Automation Platform

Follow these steps to get the application up and running on your local machine.

## 1. Prerequisites
- **Python 3.8+** installed.
- **Node.js 18+** installed.
- **Supabase Project** set up (you already did this!).

## 2. Backend Setup (API)

Open a terminal and navigate to the `backend` folder:

```powershell
cd backend
```

### Install Dependencies
Create a virtual environment (recommended) and install requirements:

```powershell
# Create virtual environment
python -m venv venv

# Activate it (Windows)
.\venv\Scripts\activate

# Install libraries
pip install -r requirements.txt
```

### Start the Server
Run the FastAPI server:

```powershell
uvicorn app.main:app --reload
```

*   **Success**: You should see "Uvicorn running on http://127.0.0.1:8000"
*   **API Docs**: Open `http://localhost:8000/docs` to see the available endpoints.

## 3. Frontend Setup (Dashboard)

Open a **new** terminal window and navigate to the `frontend` folder:

```powershell
cd frontend
```

### Install Dependencies

```powershell
npm install
```

### Start the Development Server

```powershell
npm run dev
```

*   **Success**: You should see "Ready in ... http://localhost:3000"
*   **App URL**: Open `http://localhost:3000` in your browser.

## 4. First Time Setup (Create Admin)

Since this is a fresh database, you need to create your first admin user.

1.  **Sign Up**:
    *   Go to `http://localhost:3000/signup` (or click "Get Started").
    *   Create a new account with your email and password.

2.  **Make User an Admin**:
    *   Go to your **Supabase Dashboard** > **SQL Editor**.
    *   Run this SQL command (replace with your email):

    ```sql
    UPDATE public.roles 
    SET role = 'admin' 
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
    ```

3.  **Access Admin Dashboard**:
    *   Go to `http://localhost:3000/admin/dashboard`.
    *   You should now have full access!

## 5. Verify Everything Works

### Admin Features
*   [ ] **Dashboard**: Check if the stats load.
*   [ ] **Users Page**: You should see yourself in the list.
*   [ ] **Subscriptions**: Check the filtering.
*   [ ] **Audit Logs**: Click around, then check logs to see your actions recorded.

### User Features
*   [ ] **Content Generation**: Try generating a post (requires OpenAI key).
*   [ ] **LinkedIn Posting**: (Optional) Connect a LinkedIn account if you have credentials.

## Troubleshooting

*   **"Connection Refused"**: Ensure the backend is running on port 8000.
*   **"Unauthorized"**: Make sure you set the `role = 'admin'` in the database.
*   **"Missing API Key"**: Check your `.env` files in both `backend/` and `frontend/`.

## ℹ️ Important Notes
*   **Backend URL**: `http://localhost:8000`
*   **Frontend URL**: `http://localhost:3000`
*   **Supabase URL**: `https://fpeimulivxmikmgmrqrn.supabase.co`

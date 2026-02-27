# EROS Deployment Guide 🚀

To deploy the full EROS system, follow these steps to link your GitHub repository to Vercel and Render.

## 1. Deploy the Backend (Render.com)
The backend simulator requires a persistent server for WebSockets.

1.  Create a new **Web Service** on [Render](https://render.com).
2.  Connect your GitHub repo (`nirakarpatel/eros`).
3.  Set **Root Directory** to `services/backend-engine`.
4.  Set **Build Command** to `npm install`.
5.  Set **Start Command** to `node index.js`.
6.  Add **Environment Variables**:
    *   `PORT`: `4000`
    *   `API_URL`: (Once deployed, use your Render URL, e.g., `https://eros-backend.onrender.com`)

## 2. Deploy the Dispatch Dashboard (Vercel)
1.  Create a new Project on [Vercel](https://vercel.com).
2.  Connect your GitHub repo.
3.  Set **Root Directory** to `apps/dispatch-dashboard`.
4.  **Framework Preset**: Next.js.
5.  Add **Environment Variables**:
    *   `NEXT_PUBLIC_BACKEND_URL`: (Your Render URL, e.g., `https://eros-backend.onrender.com`)
    *   `NEXT_PUBLIC_SOCKET_URL`: (Your Render URL)

## 3. Deploy the Citizen SOS WebApp (Vercel)
1.  Create another new Project on Vercel.
2.  Connect your GitHub repo.
3.  Set **Root Directory** to `mobile/citizen-sos`.
4.  **Framework Preset**: Vite.
5.  Add **Environment Variables**:
    *   `VITE_BACKEND_URL`: (Your Render URL, e.g., `https://eros-backend.onrender.com`)

---

### Sync Verification
Once all three are deployed:
1.  Open your Vercel Dashboard link.
2.  Open your Citizen SOS link on a phone (or browser).
3.  Trigger an SOS—it should appear instantly on the Dashboard!

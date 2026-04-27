# 🔧 FixBit — Local Repair Marketplace

🚀 **FixBit** is a full-stack web application that connects users with nearby repair shops for **phones, tablets, and laptops**.

Users can post repair requests, receive competitive quotes from nearby shops, and choose the best deal — all in one platform.

---

## 🌐 Live Demo

* 🔗 Frontend: https://fixbit.netlify.app/

---

## ✨ Features

### 👤 User Features

* 📍 Location-based repair request system
* 📱 Select device type & issue
* 📸 Upload images for better diagnosis
* 💰 Receive multiple price quotes
* ✅ Accept best offer
* 💬 Real-time chat with repair shop
* ⭐ Rate & review shops
* 🗺 Explore nearby shops on map

---

### 🏪 Shop Features

* 📝 Register shop with location
* 📊 Dashboard to manage incoming requests
* 💵 Send & update price quotes
* 📦 Update repair status
* 💬 Chat with customers
* 🖼 Upload shop gallery

---

### 🛠 Admin Panel

* 👥 Manage users
* 🚫 Ban / Unban accounts
* 📦 Monitor all repair requests
* 🔐 Role-based secure access

---

## 🏗 Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | HTML, CSS, JavaScript, Tailwind CSS |
| Backend  | Node.js, Express.js                 |
| Database | MySQL                               |
| Auth     | JWT, bcrypt                         |
| Storage  | Local uploads directory             |
| Maps     | Leaflet.js                          |
| Hosting  | Netlify, Render                     |

---

## 📁 Project Structure

```
fixbit/
├── fixbit_website/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── user-dashboard.html
│   │   ├── shop-dashboard.html
│   │   ├── admin.html
│   │   ├── config.js
│   │   ├── style.css
│   │   └── script.js
│   ├── backend/
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── app.js
│   │   │   ├── server.js
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   └── uploads/
│   └── database/
│       └── schema.sql
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```
git clone https://github.com/your-username/fixbit.git
cd fixbit/fixbit_website
```

---

### 2️⃣ Database Setup

```
mysql -u root -p < database/schema.sql
```

---

### 3️⃣ Backend Setup

```
cd backend
npm install
cp .env.example .env
```

Create `.env` file:

```
PORT=5050
NODE_ENV=development
DB_URL=
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fixbit
JWT_SECRET=your_secret
FRONTEND_URL=http://localhost:5500
ADMIN_EMAILS=admin@fixbit.com
```

Run backend:

```
npm run dev
```

---

### 4️⃣ Frontend Setup

```
cd frontend
npx serve
```

OR open `index.html` directly in browser

For production, set `window.FIXBIT_CONFIG.API_BASE_URL` in `frontend/config.js` to your deployed backend URL, for example `https://your-api.example.com`.

---

## 🔐 Authentication

* JWT-based authentication
* Role-based system:

  * User
  * Shop
  * Admin

---

## 📡 API Overview

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| POST   | /api/auth/register | Register user/shop    |
| POST   | /api/auth/login    | Login                 |
| POST   | /api/requests      | Create repair request |
| GET    | /api/requests/my   | Get user requests     |
| POST   | /api/responses     | Send quote            |
| GET    | /api/responses/request/:id | Get quotes    |
| POST   | /api/chat          | Send chat message     |
| GET    | /api/chat/request/:id | Load conversation   |
| GET    | /api/admin/users   | Admin user list       |

---

## 🚀 Deployment

| Service  | Platform   |
| -------- | ---------- |
| Frontend | Netlify    |
| Backend  | Render     |
| Database | TiDB Cloud |
| Storage  | Persistent disk or object storage |

---

## 📸 Screenshots

*Add your screenshots here (very important for GitHub visibility)*

---

## 🔮 Future Improvements

* 🔔 Push notifications
* 💳 Payment integration (Razorpay / Stripe)
* 📊 Admin analytics dashboard
* ⚡ Real-time chat (Socket.io)
* 📱 Mobile application

---

## 👨‍💻 Author

**Krishna Yadav**

* GitHub: https://github.com/your-username
* LinkedIn: https://linkedin.com/in/your-profile

---

## ⭐ Support

If you like this project, please give it a ⭐ on GitHub!

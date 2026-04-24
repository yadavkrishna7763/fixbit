# 🔧 FixBit — Mobile Repair Marketplace

A full-stack web application that connects users needing phone repairs with nearby repair shops.

Users can:

* Submit repair requests with location & radius
* Receive quotes from nearby shops
* Compare and accept the best deal
* Chat with shops in real-time
* Rate & review services

Includes **Admin Panel**, **Email Notifications**, and **Secure Authentication**.

---

## 📁 Project Structure

```
fixbit/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── user-register.html
│   ├── shop-register.html
│   ├── user-dashboard.html
│   ├── shop-dashboard.html
│   ├── admin.html
│   ├── style.css
│   └── script.js
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── requests.js
│   │   │   ├── responses.js
│   │   │   ├── shops.js
│   │   │   ├── reviews.js
│   │   │   ├── messages.js
│   │   │   └── admin.js
│   │   ├── utils/
│   │   │   └── email.js
│   │   └── uploads/
│   ├── .env
│   ├── package.json
│   └── package-lock.json
│
├── database/
│   └── schema.sql
└── README.md
```

---

## 🚀 Quick Start (Local Setup)

### 1️⃣ Database Setup

```bash
mysql -u root -p < database/schema.sql
```

✔ Creates database `fixbit` with all required tables

---

### 2️⃣ Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```
PORT=5050
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fixbit
JWT_SECRET=your_secret_key

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Start server:

```bash
npm run dev
```

✅ Expected output:

```
Server running on port 5050
MySQL Connected...
```

---

### 3️⃣ Frontend Setup

Run using Live Server OR open:

```
frontend/index.html
```

Update API base if needed:

```js
const API_BASE = 'http://localhost:5050/api';
```

---

### 🔐 Admin Access

* Register with: `admin@fixbit.com`
* Login → auto-redirect to admin panel

(You can edit admin emails in backend + frontend)

---

## ✅ Features

### 🔑 Authentication

* JWT-based login
* Role-based (User / Shop / Admin)
* Secure password hashing (bcrypt)

---

### 👤 User Features

* Submit repair requests (image + location)
* View requests & responses
* Compare quotes
* Accept best deal
* Chat with shop
* Review & rate shops

---

### 🏪 Shop Features

* Register with map location
* View nearby requests
* Send/update quotes
* Manage jobs
* Chat with users

---

### 🛠 Admin Panel

* View all users & requests
* Ban / Unban users
* Delete requests

---

### ⚙️ System Features

* 📍 Distance calculation (Haversine)
* 💬 Real-time chat
* 📧 Email notifications
* 🖼 Image upload (≤ 5MB)
* 📱 Responsive UI (Tailwind)
* 🚫 Rate limiting (100 req / 15 min)

---

## 📡 API Endpoints

| Method | Endpoint                  | Description     |
| ------ | ------------------------- | --------------- |
| POST   | /api/auth/register        | Register        |
| POST   | /api/auth/login           | Login           |
| POST   | /api/requests             | Create request  |
| GET    | /api/requests/nearby      | Nearby requests |
| GET    | /api/requests/my          | User requests   |
| PUT    | /api/requests/:id/accept  | Accept quote    |
| POST   | /api/responses            | Send quote      |
| POST   | /api/messages             | Send message    |
| GET    | /api/messages/request/:id | Chat messages   |
| GET    | /api/admin/users          | Admin users     |
| DELETE | /api/admin/requests/:id   | Delete request  |

---

## 🛠 Tech Stack

### Backend

* Node.js + Express
* MySQL (mysql2)
* JWT Authentication
* Bcrypt
* Multer (uploads)
* Nodemailer
* Rate Limiting

### Frontend

* HTML, CSS, JS
* Tailwind CSS
* Leaflet.js (maps)

---

## 🧪 Troubleshooting

| Issue               | Fix                    |
| ------------------- | ---------------------- |
| Backend not running | `npm run dev`          |
| API not working     | Check API_BASE         |
| Admin not opening   | Re-login               |
| Email not sending   | Use Gmail App Password |
| Map not loading     | Check internet         |

---

## 🚀 Deployment (Recommended)

* Backend: Render / Railway / VPS
* Database: PlanetScale / MySQL VPS
* Frontend: Netlify / Vercel

---

## 🔮 Future Improvements

* 🔔 Push notifications
* 💳 Payment integration
* 📊 Admin analytics
* 📱 PWA support

---

## 📝 License

Educational project — free to use and modify.

---

## 🙌 Contributors

* Krishna Yadav
* Team Members

---

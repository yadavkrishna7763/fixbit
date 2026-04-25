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
| Storage  | Cloudinary                          |
| Maps     | Leaflet.js                          |
| Hosting  | Netlify, Render                     |

---

## 📁 Project Structure

```
fixbit/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── user-dashboard.html
│   ├── shop-dashboard.html
│   ├── admin.html
│   ├── style.css
│   └── script.js
│
├── backend/
│   ├── src/
│   ├── routes/
│   ├── middleware/
│   └── utils/
│
├── database/
│   ├── schema.sql
│   └── sample_shops.sql
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```
git clone https://github.com/your-username/fixbit.git
cd fixbit
```

---

### 2️⃣ Database Setup

```
mysql -u root -p < database/schema.sql
mysql -u root -p fixbit < database/sample_shops.sql
```

---

### 3️⃣ Backend Setup

```
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
JWT_SECRET=your_secret

CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
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
| POST   | /api/messages      | Chat system           |

---

## 🚀 Deployment

| Service  | Platform   |
| -------- | ---------- |
| Frontend | Netlify    |
| Backend  | Render     |
| Database | TiDB Cloud |
| Storage  | Cloudinary |

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

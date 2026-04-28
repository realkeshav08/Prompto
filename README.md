# 🚀 Prompto | The Advanced AI Workspace

Prompto is a premium, full-stack AI platform designed for high-performance text and image generation. Built with a modern "Glassmorphic" aesthetic and a robust "Credit-as-a-Service" architecture, it provides a seamless interface for interacting with state-of-the-art neural models.

---

## 💎 Key Features

- **🧠 Dual AI Engines**: Seamlessly switch between text-based reasoning (Google Gemini) and high-fidelity image generation (ImageKit AI).
- **💳 Credit-as-a-Service**: Integrated billing system with Stripe for purchasing credits, featuring automated deduction and refund logic.
- **🎨 Showcase Gallery**: A community-driven space to publish and share neural masterpieces.
- **✨ Premium UI/UX**: Ultra-modern design using Tailwind CSS v4, featuring smooth transitions, background gradients, and a responsive glassmorphic layout.
- **🔒 Secure Architecture**: JWT-based authentication, Bcrypt encryption, and secure environment variable management.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: React Context API
- **Utilities**: Axios, React Router 7, React Hot Toast, PrismJS

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: MongoDB (via Mongoose)
- **AI Integration**: Google GenAI (Gemini), ImageKit SDK
- **Payments**: Stripe API & Webhooks

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Cluster
- Gemini API Key
- Stripe Account
- ImageKit Account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/realkeshav08/Prompto.git
   cd Prompto
   ```

2. **Setup Backend**
   - Navigate to `/server`
   - Install dependencies: `npm install`
   - Create `.env` file with the following keys:
     ```env
     JWT_SECRET=your_secret
     MONGODB_URI=your_mongodb_uri
     GEMINI_API_KEY=your_gemini_key
     IMAGEKIT_PUBLIC_KEY=...
     IMAGEKIT_PRIVATE_KEY=...
     IMAGEKIT_URL_ENDPOINT=...
     STRIPE_SECRET_KEY=...
     STRIPE_WEBHOOK_SECRET=...
     ```
   - Start dev server: `npm run dev`

3. **Setup Frontend**
   - Navigate to `/client`
   - Install dependencies: `npm install`
   - Create `.env` file:
     ```env
     VITE_SERVER_URL=http://localhost:3000
     ```
   - Start dev server: `npm run dev`

---

## 📝 License

This project is open-source. Created by [realkeshav08](https://github.com/realkeshav08).

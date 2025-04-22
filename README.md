👋 Welcome to the **Academic Paper Management System**!

This repository contains the code for a web application designed to help manage academic papers through various stages, including submission, processing, anonymization, review, and tracking. It aims to streamline the workflow for researchers, reviewers, and administrators.

---

## 🚀 Key Features

- **Paper Submission:** Users can upload their academic papers.
- **Document Categorization:** Papers are automatically categorized.
- **PDF Anonymization:** Sensitive author information can be redacted and encrypted.
- **PDF Decryption:** Restore original information in previously anonymized PDFs.
- **Review Workflow:** Reviewers can access and provide feedback on papers.
- **Paper Tracking:** Track the status of submitted papers in real time.
- **User Roles:** Interfaces for administrators, submitters ("pdfer"), and reviewers.
- **Communication:** Built‑in chat for system‑wide discussions.
- **Logging:** All activities are logged for audit and debugging.

---

## ⚙ Tech Stack

- **Frontend:** Next.js (React) with Shadcn UI components
- **Backend:** FastAPI (Python)
- **ORM:** Prisma for database interactions
- **PDF Processing:** PyMuPDF, PyPDF2
- **Cryptography:** Python `cryptography` library and custom utilities in `lib/crypto.ts`
- **Database:** PostgreSQL (configured via Prisma)

---

## 📂 File Structure Highlights

```text
├── .env               # Environment variables
├── app/               # Next.js frontend routes & pages
│   ├── api/           # Next.js API routes (route handlers)
│   └── [role]/page.tsx# Pages for admin, pdfer, reviewer, track
├── components/        # Reusable React components
│   ├── ui/            # Primitive UI components (Shadcn)
│   ├── chat-section.tsx
│   ├── file-upload.tsx
│   ├── PdfAnonymizerComponent.tsx
│   ├── PdfDecrypterComponent.tsx
│   └── track-section.tsx
├── fastapiRouter/     # FastAPI backend route definitions
├── lib/               # Utilities (crypto.ts, prisma client)
├── pdfs/              # Stored & processed PDF files
├── prisma/            # Prisma schema
├── public/            # Static assets
└── venv/              # Python virtual environment
```

---

## 🛠 Getting Started

Follow these steps to set up the application locally.

### 1. Backend Setup

```bash
# 1. Create a Python virtual environment
python3 -m venv venv

# 2. Activate the virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows PowerShell:
.\venv\Scripts\Activate

# 3. Install Python dependencies
pip install fastapi uvicorn pydantic PyMuPDF cryptography PyPDF2
```  

### 2. Database Setup (Prisma)

```bash
# Push your Prisma schema to the database
npx prisma db push

# Generate the Prisma client
npx prisma generate
```  

> **Tip:** Ensure your `.env` contains the correct `DATABASE_URL` before running these commands.

### 3. Frontend Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Copy or create a .env file
cp .env.example .env

# 3. Run the Next.js development server
npm run dev
```  

### 4. Run Services

- **Start FastAPI:**  
  ```bash
  uvicorn main:app --reload
  ```  
- **Open Frontend:**  
  Navigate to `http://localhost:3000` in your browser.

---

## 🤝 Contributing

We welcome contributions! To get started:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/YourFeature`.
3. Commit your changes: `git commit -m "Add your feature description"`.
4. Push to the branch: `git push origin feature/YourFeature`.
5. Open a pull request.

Please ensure you follow any additional guidelines in the `CONTRIBUTING.md` if present.

---

## 📜 License

This project is licensed under the terms specified in the `LICENSE` file.

---

Thank you for using the Academic Paper Management System! If you have any questions or feedback, feel free to open an issue or reach out on the project chat.


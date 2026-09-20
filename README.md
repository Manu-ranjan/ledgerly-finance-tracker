# Finance Tracker

Finance Tracker is a full-stack web app for tracking personal expenses from invoice uploads. It supports PDF, JPEG, and PNG invoices, categorizes expenses into Food, Fun, Daily items, and Essentials, and shows spending summaries in Indian Rupees.

## Tech Stack

- React 19 and Vite for the frontend
- Express 5 for the backend API
- Multer for invoice uploads
- Local JSON persistence for invoice metadata
- Local filesystem storage for uploaded invoice files

## Features

- Upload PDF, JPEG, and PNG invoices
- Add merchant, amount, date, and category details
- Suggest categories from merchant or file names
- Track Food, Fun, Daily items, and Essentials spending
- Show total spend, invoice count, top category, category chart, and recent invoices
- Open uploaded invoice files from the invoice list
- Delete invoice records and their uploaded files
- Display all money values in Indian Rupees

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite app at `http://localhost:5173`. The API runs on `http://localhost:3001`.

# 📊 Ledger — HRMS (Human Resource Management System)

A lightweight, modern, and beautifully designed Human Resource Management System. This project features a zero-dependency SQLite backend paired with a responsive, high-fidelity single-page application (SPA) frontend.

---

## ✨ Features

- **🔐 Role-Based Access Control**:
  - **Admin (HR Officer)**: Full access to the Admin Dashboard, Employee Management, Payroll adjustments, Attendance controls, Leave reviews, and the Database Explorer.
  - **Employee**: Access to their personal profile, Attendance check-in/out, and Leave request submissions.
- **📅 Attendance Tracking**:
  - Real-time check-in and check-out logs.
  - Automatic status resolution (Present, Absent, Half-day, Leave).
  - Admin tools to override and adjust attendance logs.
- **✉️ Leave Management**:
  - Self-service leave requests for employees.
  - Pending leave queue for Admin review with approval/rejection comments.
  - Approved leaves automatically update employee attendance records to **"Leave"**.
- **💳 Payroll Administration**:
  - Overview of employee salary structures.
  - Admin capability to adjust basic pay, allowances, and deductions.
- **🔎 Database Explorer**:
  - Interactive SQL terminal for administrators to run raw queries and view real-time table schemas.
- **🎨 Premium User Experience**:
  - Glassmorphic panels, gradient backgrounds, responsive typography (`Inter`, `Fraunces`, `IBM Plex Mono`), custom avatar generations, and smooth micro-animations.

---

## 🛠️ Tech Stack

- **Frontend**: Semantic HTML5, Vanilla CSS3 (custom CSS variables & gradients), Vanilla JS (reactive components, API client).
- **Backend**: Node.js & Express.js.
- **Database**: Built-in **native SQLite** (`node:sqlite`) for zero external database dependencies.

---

## ⚙️ Prerequisites

This project utilizes the **native SQLite library** (`node:sqlite` / `DatabaseSync`), which was introduced in Node.js.
* **Required**: **Node.js v22.5.0** or higher.
* *Note: Using an older version of Node.js will result in a `Module not found: node:sqlite` error.*

---

## 🚀 Getting Started

Follow these steps to run the Ledger HRMS locally:

### 1. Install Dependencies
Clone/download the repository and install the standard Express dependency:
```bash
npm install
```

### 2. Start the Server
Run the local Express server:
```bash
npm start
```
The server will seed the database automatically on its first run and output:
```text
Seeding initial HRMS data...
Seeding completed successfully!
Ledger HRMS Server running at http://localhost:8080
```

### 3. Open the Application
Navigate to [http://localhost:8080](http://localhost:8080) in your web browser.

---

## 👥 Seed User Credentials

You can use the following pre-configured credentials to test different user experiences:

| Employee ID | Name | Email | Password | Role | Department / Title |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EMP-1000** | Priya Nair | `priya.nair@ledgerhr.io` | `Admin@123` | **Admin** | People Ops / HR Officer |
| **EMP-1001** | Arjun Sen | `arjun.sen@ledgerhr.io` | `Employee@1` | **Employee** | Engineering / Frontend Engineer |
| **EMP-1002** | Meher Iqbal | `meher.iqbal@ledgerhr.io` | `Employee@1` | **Employee** | Design / Product Designer |
| **EMP-1003** | Rhea Dutta | `rhea.dutta@ledgerhr.io` | `Employee@1` | **Employee** | Finance / Payroll Analyst |

---

## 📁 Project Structure

```text
├── hrms.db              # SQLite Database file (created on first run)
├── index.html           # Main Single-Page Frontend Application (Default entry point)
├── hrms (1).html        # Alternative layout/themed HTML file
├── server.js            # Express server, seed scripts, & REST API controllers
├── package.json         # Project manifests and scripts
└── node_modules/        # Vendor dependencies
```

---

## 🔌 API Reference

All requests must be authenticated using a custom **`X-User-Id`** header carrying the employee's ID (e.g., `X-User-Id: EMP-1000`).

### Authentication API
- `POST /api/auth/signup` - Register a pending employee.
- `POST /api/auth/verify` - Confirm registration with verification code.
- `POST /api/auth/signin` - Authenticate credentials.
- `GET /api/auth/me` - Retrieve current session details.

### Profile API
- `GET /api/users` - List all employees (Admin only).
- `PUT /api/users/:id` - Edit employee profile details.
- `PUT /api/users/:id/avatar` - Update profile avatar picture.

### Attendance API
- `GET /api/attendance` - Fetch user or company-wide attendance.
- `POST /api/attendance/check-in` - Record check-in timestamp.
- `POST /api/attendance/check-out` - Record check-out timestamp.
- `POST /api/attendance/status` - Manually set attendance status (Admin only).

### Leaves API
- `GET /api/leaves` - Fetch leave history.
- `POST /api/leaves` - Submit new leave request.
- `POST /api/leaves/:id/decide` - Approve or reject leave request (Admin only).

### Payroll API
- `GET /api/payroll` - View salary structure of employees (Admin only).
- `PUT /api/payroll/:id` - Modify employee pay scale components (Admin only).

### Database Explorer API
- `GET /api/db/schema` - Read SQLite tables metadata (Admin only).
- `POST /api/db/query` - Execute raw query scripts (Admin only).

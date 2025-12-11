# SEPAKAT (Sistem Evaluasi Penilaian Kinerja Terpadu)

A Node.js based application for performance evaluation management using a Cockpit Assessment approach.

## Features

- **Admin Dashboard**: Manage Users, Matrix Templates, and Assessment Assignments.
- **Dynamic Form Builder**: Create flexible evaluation matrices with Parent/Child components.
- **Cockpit Assessment**: 
  - Side-by-side view for Main Reviewers.
  - Real-time comparison with Peer Review data.
  - Mandatory Main Reviewer input, Optional Peer Review assignment.
- **Automated Scoring**: Aggregates scores from Child Components to Parent Components.
- **Token-Based Auth**: Simple login mechanism using unique tokens.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Database**:
    Ensure you have MongoDB running locally or update `MONGODB_URI` in `.env`.

3.  **Run Server**:
    ```bash
    node server.js
    ```

4.  **Initial Setup**:
    - Visit `http://localhost:3000/seed` to create the initial Admin user.
    - You will see a message: "Admin created. Token: admin-secret-token".

## Usage Guide

### 1. Login
- Go to `http://localhost:3000/login`.
- Enter the token `admin-secret-token` to log in as Admin.

### 2. Admin Dashboard
- **Create Users**: Add Candidates and Reviewers.
- **Create Matrix**: Define the structure of the assessment (JSON format).
  - Example JSON:
    ```json
    {
      "name": "Annual Review 2024",
      "components": [
        {
          "name": "Core Competencies",
          "children": [
            { "name": "Teamwork", "type": "rating", "constraints": { "min": 1, "max": 5 } },
            { "name": "Communication", "type": "rating", "constraints": { "min": 1, "max": 5 } }
          ]
        }
      ]
    }
    ```
- **Assign Assessment**: Link a Candidate, Main Reviewer, and Template.

### 3. Reviewer Cockpit
- Log in with a User token (create one in Admin dashboard).
- **Dashboard**: See assigned assessments.
- **Assessment View**:
  - **Main Reviewer**: Fill out the form on the left. Assign peers on the right. View peer scores once submitted.
  - **Peer Reviewer**: Fill out the form.

## Tech Stack
- Node.js & Express
- MongoDB & Mongoose
- EJS (Templating)
- CSS (Custom)

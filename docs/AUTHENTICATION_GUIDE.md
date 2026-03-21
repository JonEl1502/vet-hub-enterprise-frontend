# VetHub Enterprise - Authentication Guide

## Overview

VetHub Enterprise now has a complete authentication system with email/password login, signup wizard, forgot password, and reset password functionality.

---

## 🔐 Super Admin Account

A super admin account has been created for system administration:

**Credentials:**
- **Email:** `admin@vethub.com`
- **Password:** `admin123`
- **Role:** `SUPER_ADMIN`

⚠️ **IMPORTANT:** Change this password after first login in production!

---

## 📋 Authentication Features

### 1. Email/Password Login

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "admin@vethub.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "email": "admin@vethub.com",
      "name": "Super Admin",
      "role": "SUPER_ADMIN",
      ...
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Frontend Component:** `components/AuthPages.tsx`

---

### 2. Signup Wizard (Multi-Step Registration)

**Endpoint:** `POST /api/v1/auth/signup`

**Request:**
```json
{
  "user": {
    "name": "Dr. John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "phone": "+254700000000"
  },
  "clinic": {
    "name": "VetHub Veterinary Clinic",
    "address": "123 Main Street",
    "city": "Nairobi",
    "country": "Kenya",
    "phone": "+254700000001",
    "email": "clinic@example.com",
    "logo": "data:image/png;base64,..." // Optional
  }
}
```

**Features:**
- **Step 1:** User details (name, email, password, phone)
- **Step 2:** Clinic details (name, address, city, country, phone, email, logo)
- **Step 3:** Review & confirm with terms acceptance

**Frontend Component:** `components/SignupWizard.tsx`

**What Happens:**
1. Creates a new user with `CLINIC_OWNER` role
2. Creates a new clinic
3. Links the user to the clinic
4. Returns authentication tokens

---

### 3. Forgot Password

**Endpoint:** `POST /api/v1/auth/forgot-password`

**Request:**
```json
{
  "email": "admin@vethub.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists, a password reset link has been sent"
}
```

**Frontend Component:** `components/ForgotPasswordPage.tsx`

**How It Works:**
1. User enters their email address
2. System generates a secure reset token
3. Token is stored in Redis with 1-hour expiration
4. Reset link is logged to console (in production, send via email)
5. Reset link format: `http://localhost:3000/reset-password?token=XXXXX`

**Note:** For security, the response is always the same whether the email exists or not (prevents email enumeration).

---

### 4. Reset Password

**Endpoint:** `POST /api/v1/auth/reset-password`

**Request:**
```json
{
  "token": "abc123def456...",
  "password": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Frontend Component:** `components/ResetPasswordPage.tsx`

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## 🔄 Authentication Flow

### Login Flow

```
User enters credentials
    ↓
Frontend: authAPI.login(email, password)
    ↓
Backend: POST /api/v1/auth/login
    ↓
Verify password with bcrypt
    ↓
Create session in Redis
    ↓
Generate JWT tokens
    ↓
Return user data + tokens
    ↓
Frontend: Store token in localStorage
    ↓
User is authenticated
```

### Signup Flow

```
User completes 3-step wizard
    ↓
Frontend: authAPI.signup(userData, clinicData)
    ↓
Backend: POST /api/v1/auth/signup
    ↓
Database Transaction:
  - Create Clinic
  - Create User (CLINIC_OWNER)
  - Link User to Clinic
    ↓
Create session in Redis
    ↓
Generate JWT tokens
    ↓
Return user data + tokens
    ↓
User is authenticated
```

---

## 🛠️ Testing the Authentication

### 1. Test Login (Command Line)

```bash
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vethub.com","password":"admin123"}'
```

### 2. Test Login (Frontend)

1. Open http://localhost:3000
2. Enter credentials:
   - Email: `admin@vethub.com`
   - Password: `admin123`
3. Click "Establish Clinical Session"
4. You should be logged in successfully

### 3. Test Signup Wizard

1. Click "Sign Up" on the login page
2. Complete Step 1 (User Details)
3. Complete Step 2 (Clinic Details)
4. Review and accept terms in Step 3
5. Click "Create Account"
6. You should be logged in automatically

### 4. Test Forgot Password

1. Click "Forgot Password?" on the login page
2. Enter your email address
3. Click "Send Reset Link"
4. Check backend logs for the reset token
5. Copy the reset link from logs

### 5. Test Reset Password

1. Navigate to the reset link (or click "Reset Password" and add `?token=XXX` to URL)
2. Enter new password (must meet requirements)
3. Confirm password
4. Click "Reset Password"
5. You should see success message
6. Login with new password

---

## 📁 File Structure

```
VetHub-Enterprise/
├── components/
│   ├── AuthPages.tsx           # Login page
│   ├── ForgotPasswordPage.tsx  # Forgot password page
│   ├── ResetPasswordPage.tsx   # Reset password page
│   └── SignupWizard.tsx        # Multi-step signup wizard
├── services/
│   └── api.ts                  # API service with auth endpoints
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── auth.controller.ts  # Auth endpoints
│   │   ├── services/
│   │   │   └── auth.service.ts     # Auth business logic
│   │   └── routes/
│   │       └── auth.routes.ts      # Auth routes
│   ├── scripts/
│   │   └── seed-super-admin.js     # Super admin seed script
│   └── prisma/
│       └── schema.prisma           # Database schema (with password field)
└── App.tsx                     # Main app with auth routing
```

---

## 🔒 Security Features

1. **Password Hashing:** bcrypt with 10 salt rounds
2. **JWT Tokens:** Signed with secret keys
3. **Session Management:** Redis-based sessions with 7-day expiration
4. **Password Reset:** Secure tokens with 1-hour expiration
5. **Email Enumeration Prevention:** Same response for existing/non-existing emails
6. **CORS Protection:** Configured for localhost:3000
7. **Rate Limiting:** Prevents brute force attacks (configured in backend)

---

## 🚀 Next Steps

1. **Configure Email Service:** Replace console logging with actual email sending
2. **Add Google OAuth:** Already configured, just need client credentials
3. **Implement 2FA:** Add two-factor authentication
4. **Add Password Strength Meter:** Visual feedback for password strength
5. **Add Remember Me:** Extend session duration option
6. **Add Account Verification:** Email verification after signup

---

## 📝 Notes

- All passwords are hashed before storage
- Tokens are stored in localStorage on the frontend
- Sessions are stored in Redis with automatic expiration
- BigInt values are converted to strings for JSON serialization
- The super admin account has no clinic association (system-wide access)

---

**Created:** 2025-12-22  
**Version:** 1.0.0


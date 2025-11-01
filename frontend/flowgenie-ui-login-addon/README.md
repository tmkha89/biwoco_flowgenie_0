# FlowGenie UI - Login/Logout Add-on (TypeScript / React / Tailwind)

This folder is an **add-on** to an existing React + Tailwind TypeScript project. Drop `src/` files into your project (or merge selectively).

## What is included
- `src/components/LoginForm.tsx`
- `src/components/Navbar.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/context/AuthContext.tsx`
- `src/api/auth.ts` (mocked login)
- `src/App.tsx` (router + integration example)

## Quick integration steps
1. Copy files into your project's `src/` folder.
2. Ensure you have React Router v6 installed:
   ```bash
   npm install react-router-dom
   # or
   yarn add react-router-dom
   ```
3. Ensure Tailwind is configured in your project (these components use Tailwind classes).
4. Replace your `App.tsx` or merge the `Routes` into your existing router.
5. Run your app:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Notes
- `src/api/auth.ts` is a mock. Replace with calls to your backend (Axios/fetch).
- Token is stored in `localStorage` under `flowgenie_token`.
- `ProtectedRoute` will redirect unauthenticated users to `/login`.

If you want, I can also:
- Convert the mock `api/auth.ts` to an Axios-based implementation.
- Add a `useUser` hook that fetches user profile from `/api/auth/me`.
- Wire Google OAuth2 (frontend + guide for backend exchange flow).

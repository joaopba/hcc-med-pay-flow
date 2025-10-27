# 🤖 AI Rules for HCC Med Pay Flow Application

This document outlines the core technologies used in this project and provides clear guidelines on which libraries to use for specific functionalities. Adhering to these rules ensures consistency, maintainability, and optimal performance.

## 🚀 Tech Stack Overview

*   **Frontend Framework**: React with TypeScript
*   **Build Tool**: Vite
*   **UI Component Library**: shadcn/ui (built on Radix UI)
*   **Styling**: Tailwind CSS
*   **Backend-as-a-Service**: Supabase (for Database, Authentication, Storage, and Edge Functions)
*   **Client-Side Routing**: React Router DOM
*   **Form Management & Validation**: React Hook Form and Zod
*   **Icons**: Lucide React
*   **Data Fetching & Caching**: React Query (@tanstack/react-query)
*   **Notifications**: Sonner (for toasts)
*   **Charting**: Recharts
*   **PDF Generation**: jsPDF and jspdf-autotable
*   **Excel Handling**: XLSX
*   **Animations**: Framer Motion
*   **Date Utilities**: date-fns

## 📚 Library Usage Rules

To maintain a consistent and efficient codebase, please follow these guidelines when implementing features:

1.  **UI Components**:
    *   **Always** prioritize `shadcn/ui` components for all user interface elements (buttons, inputs, cards, dialogs, tables, etc.).
    *   If a specific `shadcn/ui` component is not available or does not meet the exact requirements, create a new, small, and focused component in `src/components/` that either wraps existing `shadcn/ui` primitives or is built from scratch using Tailwind CSS. **Do not modify `shadcn/ui` component files directly.**

2.  **Styling**:
    *   **Exclusively** use Tailwind CSS classes for all styling. Avoid inline styles or custom CSS files (except for `src/index.css` for global styles and theme variables).
    *   Ensure designs are responsive by utilizing Tailwind's responsive utility classes.

3.  **State Management**:
    *   For local component state, use React's built-in `useState` and `useReducer` hooks.
    *   For global state, data fetching, caching, and synchronization with the server, use `@tanstack/react-query`.

4.  **Routing**:
    *   Use `react-router-dom` for all client-side navigation.
    *   All main application routes should be defined within `src/App.tsx`.
    *   Pages should reside in `src/pages/`.

5.  **Backend Interaction**:
    *   All interactions with the backend (database queries, authentication, file storage, invoking Edge Functions) must be done using the `supabase` client imported from `src/integrations/supabase/client.ts`.
    *   Ensure Row Level Security (RLS) is considered for all database operations.

6.  **Forms & Validation**:
    *   Use `react-hook-form` for managing form state, validation, and submission.
    *   Use `zod` for defining form schemas and performing data validation.

7.  **Icons**:
    *   Use icons from the `lucide-react` library.

8.  **Notifications**:
    *   For user feedback and transient messages (e.g., success/error messages after an action), use `sonner` for toast notifications.

9.  **Charts**:
    *   For data visualization and graphical representations, use `recharts`.

10. **PDF Generation**:
    *   For generating PDF documents (e.g., reports), use `jspdf` in conjunction with `jspdf-autotable`.

11. **Excel Handling**:
    *   For importing and exporting data to/from Excel files, use the `xlsx` library.

12. **Animations**:
    *   For declarative and performant animations, use `framer-motion`.

13. **Date Handling**:
    *   For parsing, formatting, and manipulating dates, use `date-fns`.

By following these rules, we ensure a cohesive and high-quality application.
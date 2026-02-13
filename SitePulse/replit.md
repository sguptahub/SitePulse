# replit.md

## Overview

This is a comprehensive SEO and Accessibility Auditor web application. The application allows users to input website URLs and receive detailed analysis reports covering meta tags, accessibility issues, broken links, performance metrics, and actionable recommendations. The system provides a complete audit scoring system with visual feedback and detailed breakdowns of website health metrics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for type safety and modern component patterns
- **Vite** as the build tool and development server for fast hot module replacement
- **TanStack Query** for server state management, caching, and API interactions
- **Wouter** as a lightweight client-side routing solution
- **Tailwind CSS** with custom CSS variables for responsive design and theming
- **shadcn/ui** component library built on Radix UI primitives for accessible UI components

### Backend Architecture
- **Express.js** server with TypeScript for API endpoints and middleware
- **RESTful API design** with structured error handling and request logging
- **Modular service architecture** with separate audit service for website analysis
- **Storage abstraction layer** with in-memory storage implementation (ready for database integration)

### Data Storage
- **Drizzle ORM** configured for PostgreSQL with schema-first approach
- **Neon Database** integration via connection string configuration
- **Database schema** includes users table and audit_reports table with JSON fields for complex data
- **Migration system** with Drizzle Kit for schema management

### Web Scraping & Analysis Engine
- **Cheerio** for HTML parsing and DOM manipulation
- **Axios** for HTTP requests with timeout and error handling
- **URL validation** and broken link detection
- **Meta tag analysis** with status classification (good/warning/error)
- **Accessibility scanning** for common WCAG compliance issues
- **Performance metrics** collection including load times and content size

### Authentication & Session Management
- **Session-based authentication** with PostgreSQL session store
- **User management** with secure password handling
- **Request middleware** for authentication and authorization

### UI/UX Design System
- **Design tokens** with CSS custom properties for consistent theming
- **Responsive breakpoints** with mobile-first approach
- **Accessible components** using ARIA patterns and semantic HTML
- **Loading states** and error boundaries for improved user experience
- **Toast notifications** for user feedback and status updates

### Development & Build Pipeline
- **TypeScript** strict mode configuration with path mapping
- **ESBuild** for production server bundling
- **PostCSS** with Tailwind and Autoprefixer for CSS processing
- **Development hot reload** with Vite middleware integration

## External Dependencies

### Database & Infrastructure
- **Neon Database** - Serverless PostgreSQL hosting
- **@neondatabase/serverless** - Database connection driver

### UI & Styling
- **@radix-ui/* packages** - Accessible component primitives
- **Tailwind CSS** - Utility-first CSS framework
- **class-variance-authority** - Component variant management
- **Lucide React** - Icon library

### Data Management
- **@tanstack/react-query** - Server state management
- **react-hook-form** - Form handling and validation
- **@hookform/resolvers** - Form validation resolvers
- **Zod** - Runtime type validation

### Web Scraping & Analysis
- **Cheerio** - Server-side HTML parsing
- **Axios** - HTTP client for web requests

### Development Tools
- **Vite** - Build tool and development server
- **TypeScript** - Type checking and compilation
- **Drizzle ORM** - Database toolkit and query builder
- **ESBuild** - JavaScript bundler

### Session & Security
- **express-session** - Session middleware
- **connect-pg-simple** - PostgreSQL session store
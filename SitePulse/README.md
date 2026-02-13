# SEO & Accessibility Audit Tool

A comprehensive web application for analyzing website SEO performance and accessibility compliance. Get detailed insights into your website's health with actionable recommendations for improvement.

## 🚀 Features

### Core Audit Capabilities
- **Meta Tag Analysis** - Comprehensive evaluation of title tags, meta descriptions, Open Graph tags, and schema markup
- **Broken Link Detection** - Identifies and reports all broken internal and external links
- **Semantic HTML Validation** - Checks for proper HTML structure and semantic elements
- **Image Alt-Text Checking** - Ensures all images have appropriate alternative text for accessibility
- **Accessibility Scanning** - WCAG compliance testing for common accessibility issues
- **Performance Metrics** - Load time analysis and content size optimization suggestions

### Advanced Features
- **Bulk URL Analysis** - Process multiple websites simultaneously
- **Competitive Analysis** - Compare your site against competitors
- **Historical Tracking** - Monitor SEO improvements over time
- **PDF Report Generation** - Professional audit reports for clients
- **Real-time Scoring** - Instant feedback with visual scoring system

### User Experience
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Dark/Light Mode** - Toggle between themes for comfortable viewing
- **Interactive Dashboard** - Visual charts and progress indicators
- **Export Options** - Download reports in multiple formats

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe component development
- **Vite** for fast development and optimized builds
- **TanStack Query** for efficient server state management
- **Tailwind CSS** for responsive, utility-first styling
- **shadcn/ui** component library built on Radix UI primitives
- **Wouter** for lightweight client-side routing

### Backend
- **Express.js** with TypeScript for robust API development
- **Cheerio** for server-side HTML parsing and analysis
- **Axios** for reliable HTTP requests and web scraping
- **Drizzle ORM** with PostgreSQL for data persistence

### Database & Infrastructure
- **PostgreSQL** with Neon Database integration
- **Session-based authentication** with secure password handling
- **RESTful API design** with structured error handling

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- PostgreSQL database (Neon Database recommended)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/seo-audit-tool.git
cd seo-audit-tool
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret_key
PORT=5000
```

### 4. Database Setup
```bash
# Push database schema
npm run db:push

# Optional: Seed with sample data
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5000` to access the application.

## 📖 Usage Guide

### Running an SEO Audit

1. **Enter Website URL**: Input the website URL you want to analyze
2. **Start Audit**: Click "Run Audit" to begin the comprehensive analysis
3. **Review Results**: Examine the detailed report with scores and recommendations
4. **Export Report**: Download the results as a PDF for sharing or archiving

### Understanding Audit Scores

- **🟢 Good (80-100)**: Excellent implementation, minimal issues
- **🟡 Warning (60-79)**: Room for improvement, moderate issues
- **🔴 Error (0-59)**: Critical issues requiring immediate attention

### Bulk Analysis

1. Navigate to the "Bulk Analysis" section
2. Upload a CSV file with URLs or enter multiple URLs
3. Configure audit settings for all URLs
4. Monitor progress and download comprehensive reports

## 🏗️ Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components and routing
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions and configurations
├── server/                # Backend Express application
│   ├── services/          # Business logic and audit services
│   ├── routes.ts          # API route definitions
│   └── storage.ts         # Data access layer
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema and types
└── package.json           # Project dependencies and scripts
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Database
npm run db:push         # Push schema changes to database
npm run db:studio       # Open Drizzle Studio for database management

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript compiler check
```

## 🚀 Deployment

### Using Replit
1. Fork this repository on Replit
2. Set up environment variables in the Secrets tab
3. Run the application using the "Run" button

### Using Vercel/Netlify
1. Connect your GitHub repository
2. Set environment variables in the platform dashboard
3. Deploy with automatic builds on push

### Docker Deployment
```bash
# Build Docker image
docker build -t seo-audit-tool .

# Run container
docker run -p 5000:5000 --env-file .env seo-audit-tool
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 API Documentation

### Audit Endpoints

#### POST /api/audit
Run a comprehensive SEO audit on a website.

**Request Body:**
```json
{
  "url": "https://example.com",
  "options": {
    "checkBrokenLinks": true,
    "includeAccessibility": true,
    "generatePdf": false
  }
}
```

**Response:**
```json
{
  "score": 85,
  "url": "https://example.com",
  "metaTags": {
    "title": { "status": "good", "content": "Example Site" },
    "description": { "status": "warning", "content": "Short description" }
  },
  "brokenLinks": [],
  "accessibility": { "score": 90, "issues": [] },
  "recommendations": ["Add meta description", "Optimize images"]
}
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify your `DATABASE_URL` is correct
- Ensure your database is accessible and running
- Check firewall settings for database connections

**Audit Timeouts**
- Large websites may take longer to analyze
- Consider adjusting timeout settings in the configuration
- Use bulk analysis for multiple small audits instead

**Missing Dependencies**
- Run `npm install` to ensure all packages are installed
- Clear `node_modules` and reinstall if issues persist

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue for bug reports or feature requests
- Check existing issues before creating new ones
- Provide detailed information for faster resolution

## 🙏 Acknowledgments

- Built with modern web technologies and best practices
- Inspired by industry-standard SEO audit tools
- Thanks to the open-source community for amazing libraries

---

Made with ❤️ for better web accessibility and SEO
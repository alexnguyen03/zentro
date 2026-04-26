# Contributing to Zentro

Thank you for your interest in contributing to Zentro!

## Getting Started

### Prerequisites

- **Go 1.22+**
- **Node.js 18+**
- **Wails CLI** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/alexnguyen03/zentro.git
cd zentro

# Install frontend dependencies
npm install

# Run in development mode
wails dev
```

### Building

```bash
# Build for current platform
wails build

# Build for Windows
wails build -target windows

# Build for macOS
wails build -target darwin
```

## Code Conventions

### Go

- Follow standard Go conventions: `go fmt`, `go vet`
- Use meaningful variable names
- Add comments for exported functions
- Keep functions focused and small

### Frontend (React/TypeScript)

- Use functional components with hooks
- Follow existing naming conventions
- Run `npm run lint` before committing

### Git Commit Messages

Use clear, descriptive commit messages:

```
<type>: <short description>

<optional body>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat: add query timeout setting

Add configurable timeout for query execution in preferences.
```

## Pull Request Process

1. Create a feature branch from `dev`: `git checkout -b feature/my-feature`
2. Make your changes
3. Test locally with `wails dev`
4. Push and create a Pull Request to `dev` branch
5. Ensure CI checks pass
6. Wait for review

## Issue Reporting

Use the provided issue templates:
- **Bug Report**: For reporting issues with steps to reproduce
- **Feature Request**: For proposing new features

Include:
- Clear description
- Steps to reproduce (for bugs)
- Environment details (OS, version)
- Screenshots if applicable

## Security

If you discover a security vulnerability, please do NOT open an issue. Email directly to the maintainer.

---

Questions? Feel free to open a discussion on GitHub.

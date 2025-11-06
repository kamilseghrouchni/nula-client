# Contributing to Nula Labs

Thank you for your interest in contributing to Nula Labs! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node.js version, browser)
- Screenshots or error messages if applicable

### Suggesting Features

We love feature suggestions! Please open an issue with:
- A clear description of the feature
- Use cases and benefits
- Any implementation ideas you have

### Contributing Code

All code contributions must be submitted via pull requests. Direct pushes to the main branch are not allowed.

## Pull Request Process

### 1. Fork the Repository

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/nula-client.git
cd nula-client
```

### 2. Set Up Your Environment

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your Anthropic API key to .env
```

### 3. Create a Feature Branch

```bash
# Create a new branch from main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

### 4. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Keep functions focused and small
- Test your changes thoroughly

### 5. Test Your Changes

```bash
# Run type checking
npm run typecheck

# Run linter
npm run lint

# Run dev server and test manually
npm run dev
```

### 6. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add new MCP server integration for proteomics"

# Or for bug fixes
git commit -m "fix: resolve workflow graph layout issues"
```

**Commit message format:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or updates
- `chore:` - Maintenance tasks

### 7. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 8. Create a Pull Request

1. Go to the [original repository](https://github.com/kamilseghrouchni/nula-client)
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template with:
   - **Description**: What changes you made and why
   - **Related Issues**: Link any related issues
   - **Testing**: How you tested your changes
   - **Screenshots**: If applicable

### 9. Code Review

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged!

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` types when possible
- Use meaningful variable and function names

### React Components

- Use functional components with hooks
- Keep components focused on a single responsibility
- Extract reusable logic into custom hooks
- Use proper prop types

### File Organization

```
src/
├── app/           # Next.js routes
├── components/    # React components
├── lib/           # Utilities and business logic
└── styles/        # Global styles
```

### Code Formatting

We use Prettier for code formatting:

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

## MCP Server Development

If you're contributing MCP server integrations:

1. **Follow MCP best practices**:
   - Use atomic, focused tools
   - Provide clear tool descriptions
   - Handle errors gracefully
   - Document all parameters

2. **Security considerations**:
   - Never expose sensitive data in tool responses
   - Validate all inputs
   - Use environment variables for credentials
   - Follow the forbidden tools patterns (no code execution tools)

3. **Testing**:
   - Test with multiple data scenarios
   - Verify error handling
   - Check token efficiency
   - Ensure graceful degradation

## Documentation

- Update README.md if you add features
- Add JSDoc comments for public functions
- Update CLAUDE.md for architectural changes
- Include examples in your PR description

## Testing with Multiple MCP Servers

When testing changes:
- Test with both local (STDIO) and remote (HTTP) servers
- Verify graceful degradation when servers fail
- Check tool namespacing works correctly
- Test with various data types and edge cases

## What to Avoid

- Committing `.env` files or secrets
- Making breaking changes without discussion
- Pushing directly to main (PRs required)
- Large PRs with multiple unrelated changes
- Committing generated files (build artifacts, etc.)

## Getting Help

- Open an issue for questions
- Check existing issues and PRs
- Review the [README](README.md) and [CLAUDE.md](CLAUDE.md)
- Read the [MCP documentation](https://modelcontextprotocol.io)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Nula Labs! Your efforts help make bioanalysis more accessible to researchers worldwide.

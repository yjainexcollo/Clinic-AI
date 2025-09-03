# Clinic-AI 🏥🤖

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

AI-powered clinic management system with speech-to-text, large language model integration, and Electronic Health Record (EHR) capabilities. Built with Clean Architecture principles for scalability and maintainability.

## ✨ Features

- **🤖 AI-Powered Services**

  - Speech-to-Text transcription for medical consultations
  - Large Language Model integration for medical documentation
  - OCR capabilities for document processing
  - Intelligent SOAP note generation

- **🏥 Healthcare Management**

  - Patient registration and management
  - Consultation scheduling and tracking
  - Medical record management
  - EHR integration capabilities

- **🏗️ Modern Architecture**

  - Clean Architecture with domain-driven design
  - FastAPI for high-performance API
  - MongoDB with Beanie ODM
  - Redis caching layer
  - Comprehensive testing strategy

- **🔒 Security & Compliance**
  - JWT-based authentication
  - Role-based access control
  - HIPAA-compliant data handling
  - Secure external service integration

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- MongoDB 6.0+
- Redis 6.0+
- Docker (optional)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/clinicai.git
   cd clinicai
   ```

2. **Set up virtual environment**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -e .
   pip install -e ".[dev]"
   ```

4. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run the application**
   ```bash
   make dev
   ```

The API will be available at `http://localhost:8000`

## 📚 Documentation

- [API Documentation](http://localhost:8000/docs) - Interactive API docs
- [Architecture Guide](docs/architecture.md) - System design and architecture
- [Development Guide](docs/development.md) - Contributing guidelines

## 🏗️ Project Structure

```
clinicai/
├── src/clinicai/           # Source code
│   ├── api/               # FastAPI presentation layer
│   ├── application/       # Use cases and application services
│   ├── domain/           # Business logic and entities
│   ├── adapters/         # Infrastructure implementations
│   ├── core/             # Configuration and utilities
│   └── observability/    # Logging, tracing, metrics
├── tests/                # Test suite
├── docs/                 # Documentation
├── scripts/              # Utility scripts
└── docker/               # Containerization
```

## 🧪 Testing

```bash
# Run all tests
make test

# Run specific test types
pytest tests/unit/ -v
pytest tests/integration/ -v
pytest tests/e2e/ -v

# Run with coverage
pytest --cov=src/clinicai tests/
```

## 🔧 Development

### Code Quality

```bash
# Format code
make format

# Check code quality
make lint

# Type checking
mypy src/
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## 🐳 Docker

```bash
# Build image
make docker-build

# Run container
make docker-run
```

## 📋 Available Commands

```bash
make help          # Show all available commands
make install       # Install dependencies
make test          # Run tests
make lint          # Check code quality
make format        # Format code
make clean         # Clean generated files
make dev           # Start development server
make docker-build  # Build Docker image
make docker-run    # Run Docker container
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Ensure all checks pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@clinicai.com
- 💬 Discord: [Clinic-AI Community](https://discord.gg/clinicai)
- 📖 Documentation: [docs.clinicai.com](https://docs.clinicai.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/clinicai/issues)

## 🙏 Acknowledgments

- FastAPI community for the excellent web framework
- MongoDB team for the robust database
- OpenAI and Mistral for AI capabilities
- Healthcare professionals for domain expertise

---

**Made with ❤️ for better healthcare**

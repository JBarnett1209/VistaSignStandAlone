"""
Test runner for VistaSign
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from app.core.database import init_db


async def setup_test_database():
    """Setup test database"""
    print("🔧 Setting up test database...")
    await init_db()
    print("✅ Test database setup complete")


def run_unit_tests():
    """Run unit tests"""
    print("🧪 Running unit tests...")
    
    # Test files to run
    test_files = [
        "tests/test_document_conversion.py",
        "tests/test_token_validation.py",
        "tests/test_signature_verification.py"
    ]
    
    # Run tests
    result = pytest.main([
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
        *test_files
    ])
    
    return result


def run_integration_tests():
    """Run integration tests"""
    print("🔗 Running integration tests...")
    
    # Integration test files
    test_files = [
        "tests/test_api_endpoints.py",
        "tests/test_database_operations.py"
    ]
    
    # Run tests
    result = pytest.main([
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
        "--asyncio-mode=auto",  # Async test support
        *test_files
    ])
    
    return result


def run_security_tests():
    """Run security tests"""
    print("🔒 Running security tests...")
    
    # Security test files
    test_files = [
        "tests/test_security.py",
        "tests/test_authentication.py",
        "tests/test_authorization.py"
    ]
    
    # Run tests
    result = pytest.main([
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
        *test_files
    ])
    
    return result


def run_performance_tests():
    """Run performance tests"""
    print("⚡ Running performance tests...")
    
    # Performance test files
    test_files = [
        "tests/test_performance.py",
        "tests/test_load.py"
    ]
    
    # Run tests
    result = pytest.main([
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
        *test_files
    ])
    
    return result


def run_all_tests():
    """Run all tests"""
    print("🚀 Running all tests...")
    
    # Run all test files
    result = pytest.main([
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
        "--asyncio-mode=auto",  # Async test support
        "tests/"  # Run all tests in tests directory
    ])
    
    return result


def generate_test_report():
    """Generate test report"""
    print("📊 Generating test report...")
    
    # Generate HTML report
    result = pytest.main([
        "--html=test_report.html",  # HTML report
        "--self-contained-html",  # Self-contained HTML
        "--tb=short",  # Short traceback format
        "tests/"  # Run all tests
    ])
    
    print("📄 Test report generated: test_report.html")
    return result


def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="VistaSign Test Runner")
    parser.add_argument(
        "--type",
        choices=["unit", "integration", "security", "performance", "all"],
        default="all",
        help="Type of tests to run"
    )
    parser.add_argument(
        "--setup-db",
        action="store_true",
        help="Setup test database before running tests"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate test report"
    )
    
    args = parser.parse_args()
    
    # Setup test database if requested
    if args.setup_db:
        asyncio.run(setup_test_database())
    
    # Run tests based on type
    if args.type == "unit":
        result = run_unit_tests()
    elif args.type == "integration":
        result = run_integration_tests()
    elif args.type == "security":
        result = run_security_tests()
    elif args.type == "performance":
        result = run_performance_tests()
    elif args.type == "all":
        result = run_all_tests()
    
    # Generate report if requested
    if args.report:
        generate_test_report()
    
    # Exit with test result
    sys.exit(result)


if __name__ == "__main__":
    main()

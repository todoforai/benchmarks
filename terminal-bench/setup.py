from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="todoforai-tbench",
    version="0.1.0",
    author="TODOforAI",
    author_email="support@todoforai.com",
    description="TODOforAI adapter for Terminal-Bench evaluation",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/todoforai/todoforai",
    packages=find_packages(),
    package_data={
        "todoforai_tbench": ["scripts/*.sh"],
    },
    include_package_data=True,
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Testing",
    ],
    python_requires=">=3.10",
    install_requires=[
        "terminal-bench>=0.1.0",
    ],
    extras_require={
        "anthropic": ["anthropic>=0.30.0"],
        "openai": ["openai>=1.0.0"],
        "full": [
            "anthropic>=0.30.0",
            "openai>=1.0.0",
            "todoai-cli>=0.1.0",
        ],
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "todoforai-tbench=run_benchmark:main",
        ],
    },
)

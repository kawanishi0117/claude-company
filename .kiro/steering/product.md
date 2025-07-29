# Product Overview

Claude Company System is a hierarchical AI development system that automates project development through AI collaboration. The system operates on Windows Docker environments where a Boss AI manages multiple Subordinate AIs to execute development tasks.

## Core Concept

- **Boss AI**: Receives user instructions, breaks them into tasks, reviews code, and performs integration testing
- **Subordinate AIs**: Execute specific development tasks, write unit tests, and submit deliverables
- **User (CEO)**: Provides high-level instructions through a web dashboard

## Key Value Propositions

- Automated parallel development with multiple AI agents
- Complete isolation through Docker containers
- Real-time monitoring and progress tracking
- Automatic testing and Git version control
- One-command deployment and setup

## Target Use Cases

- REST API development with Node.js
- React frontend applications with Material-UI
- Adding authentication features to existing systems
- Any development task that can be broken into parallel subtasks

## System Architecture

The system uses a queue-based task distribution model where the Boss AI decomposes user instructions into specific tasks, distributes them to available Subordinate AIs, and then integrates the results with proper testing and Git management.